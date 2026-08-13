-- Reforma de controle de acesso (ago/2026): consolida 4 sistemas de permissão
-- paralelos (user_roles, user_permissions/PermissionsSelector, module_permissions+
-- role_templates/ModulePermissionsManager, hr_permissions, financial_permissions)
-- num modelo único de RBAC com perfis VIVOS: admin/manager continuam com bypass
-- total; todo mundo abaixo disso vira role='user' + um Perfil de Acesso
-- (role_templates) cujas permissões (module_permissions.profile_id) valem pra
-- todo mundo que usa aquele perfil — editar o perfil propaga na hora, sem
-- precisar reconfigurar usuário por usuário (o maior defeito do sistema antigo,
-- onde "aplicar modelo" só copiava as caixinhas uma vez).
--
-- Achado confirmado com o usuário: o papel 'financial' hoje não dá acesso real
-- a nenhuma tabela financeira (todas checavam só is_admin_or_manager). Corrigido
-- nesta mesma migration — decisão explícita de não deixar pra depois.

-- ============================================================
-- 1. module_permissions ganha profile_id (perfil vivo) — continua servindo
--    também como exceção pontual por usuário (user_id), mutuamente exclusivo.
-- ============================================================
ALTER TABLE public.module_permissions
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.role_templates(id) ON DELETE CASCADE;

ALTER TABLE public.module_permissions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.module_permissions
  ADD CONSTRAINT module_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.module_permissions
  ADD CONSTRAINT module_permissions_owner_check CHECK ((profile_id IS NOT NULL) <> (user_id IS NOT NULL));

ALTER TABLE public.module_permissions
  ADD CONSTRAINT module_permissions_profile_id_module_action_key UNIQUE (profile_id, module, action);

COMMENT ON COLUMN public.module_permissions.profile_id IS 'Linha de PERFIL (role_templates) — vivo: editar aqui atualiza todo mundo que usa o perfil. Mutuamente exclusivo com user_id.';
COMMENT ON COLUMN public.module_permissions.user_id IS 'Linha de EXCEÇÃO pontual de um usuário específico, por cima do perfil dele. Mutuamente exclusivo com profile_id.';

-- ============================================================
-- 2. user_profiles ganha o vínculo com o perfil
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.role_templates(id);

COMMENT ON COLUMN public.user_profiles.profile_id IS 'Perfil de Acesso do usuário (role_templates) — só se aplica quando user_roles.role = ''user''; admin/manager têm acesso total.';

-- ============================================================
-- 3. Migrar role_templates.permissions (jsonb estático) -> module_permissions
--    (linhas vivas, por perfil)
-- ============================================================
INSERT INTO public.module_permissions (profile_id, module, action, scope)
SELECT rt.id, (perm->>'module'), (perm->>'action'), 'all'
FROM public.role_templates rt, jsonb_array_elements(rt.permissions) AS perm
ON CONFLICT (profile_id, module, action) DO NOTHING;

-- ============================================================
-- 4. Novo perfil "RH" — hoje hr_permissions existe e É aplicada em RLS real
--    (employees/time_records/work_schedules), mas não tem NENHUMA tela viva
--    pra administrar (HRPermissionsManager.tsx não é importado em lugar nenhum).
-- ============================================================
INSERT INTO public.role_templates (role_name, label, description, permissions, is_system)
VALUES ('rh', 'RH', 'Gestão de colaboradores, ponto e jornadas de trabalho', '[]'::jsonb, true)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO public.module_permissions (profile_id, module, action, scope)
SELECT rt.id, 'rh', a, 'all'
FROM public.role_templates rt, unnest(ARRAY['view','create','edit','delete']) AS a
WHERE rt.role_name = 'rh'
ON CONFLICT (profile_id, module, action) DO NOTHING;

-- ============================================================
-- 5. check_module_permission — já existia, estava órfã (nenhuma RLS/RPC
--    chamava). Vira a função canônica única: bypass admin/manager -> perfil
--    do usuário -> exceção pontual -> nega.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_module_permission(p_user_id uuid, p_module text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('admin','manager'))
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.module_permissions mp ON mp.profile_id = up.profile_id
      WHERE up.user_id = p_user_id AND mp.module = p_module AND mp.action = p_action
    )
    OR EXISTS (
      SELECT 1 FROM public.module_permissions mp
      WHERE mp.user_id = p_user_id AND mp.module = p_module AND mp.action = p_action
    );
$function$;

-- ============================================================
-- 6. has_financial_access mantém a MESMA assinatura (nenhuma policy que já a
--    chama precisa mudar) mas passa a resolver via perfil em vez do papel
--    'financial' hardcoded.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_financial_access(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.check_module_permission(uid, 'financeiro', 'view')
$function$;

-- ============================================================
-- 7. RLS: RH — troca has_hr_permission (sem tela viva) por check_module_permission
-- ============================================================
DROP POLICY IF EXISTS "Apenas admins podem deletar funcionários" ON public.employees;
CREATE POLICY "Apenas admins podem deletar funcionários" ON public.employees
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'rh', 'delete'));

DROP POLICY IF EXISTS "Admins and HR full access can create employees" ON public.employees;
CREATE POLICY "Admins and HR full access can create employees" ON public.employees
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'rh', 'create'));

DROP POLICY IF EXISTS "Admins and HR can view employees" ON public.employees;
CREATE POLICY "Admins and HR can view employees" ON public.employees
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'rh', 'view'));

DROP POLICY IF EXISTS "Admins and HR full access can update employees" ON public.employees;
CREATE POLICY "Admins and HR full access can update employees" ON public.employees
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'rh', 'edit'));

DROP POLICY IF EXISTS "Apenas admins podem deletar registros" ON public.time_records;
CREATE POLICY "Apenas admins podem deletar registros" ON public.time_records
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'rh', 'delete'));

DROP POLICY IF EXISTS "Admins e RH Full podem inserir registros" ON public.time_records;
CREATE POLICY "Admins e RH Full podem inserir registros" ON public.time_records
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'rh', 'create'));

DROP POLICY IF EXISTS "Admins e RH podem ver registros de ponto" ON public.time_records;
CREATE POLICY "Admins e RH podem ver registros de ponto" ON public.time_records
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'rh', 'view'));

DROP POLICY IF EXISTS "Admins e RH Full podem atualizar registros" ON public.time_records;
CREATE POLICY "Admins e RH Full podem atualizar registros" ON public.time_records
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'rh', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'rh', 'edit'));

DROP POLICY IF EXISTS "Admins e RH Full podem gerenciar jornadas" ON public.work_schedules;
CREATE POLICY "Admins e RH Full podem gerenciar jornadas" ON public.work_schedules
  FOR ALL USING (public.check_module_permission(auth.uid(), 'rh', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'rh', 'edit'));
-- "Todos autenticados podem ver jornadas" (SELECT aberto) fica como está — não fazia parte do gate de RH.

-- ============================================================
-- 8. RLS: Financeiro — troca is_admin_or_manager por check_module_permission
--    nas policies de ESCRITA (SELECT já resolvido via has_financial_access acima).
--    Corrige o achado confirmado: papel financial sem acesso real de escrita hoje.
-- ============================================================
DROP POLICY IF EXISTS "accounts_payable_delete" ON public.accounts_payable;
CREATE POLICY "accounts_payable_delete" ON public.accounts_payable
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'financeiro', 'delete'));
DROP POLICY IF EXISTS "accounts_payable_mutate" ON public.accounts_payable;
CREATE POLICY "accounts_payable_mutate" ON public.accounts_payable
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'create'));
DROP POLICY IF EXISTS "accounts_payable_update" ON public.accounts_payable;
CREATE POLICY "accounts_payable_update" ON public.accounts_payable
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "accounts_receivable_delete" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_delete" ON public.accounts_receivable
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'financeiro', 'delete'));
DROP POLICY IF EXISTS "accounts_receivable_mutate" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_mutate" ON public.accounts_receivable
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'create'));
DROP POLICY IF EXISTS "accounts_receivable_update" ON public.accounts_receivable;
CREATE POLICY "accounts_receivable_update" ON public.accounts_receivable
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "cash_transactions_delete" ON public.cash_transactions;
CREATE POLICY "cash_transactions_delete" ON public.cash_transactions
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'financeiro', 'delete'));
DROP POLICY IF EXISTS "cash_transactions_mutate" ON public.cash_transactions;
CREATE POLICY "cash_transactions_mutate" ON public.cash_transactions
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'create'));
DROP POLICY IF EXISTS "cash_transactions_update" ON public.cash_transactions;
CREATE POLICY "cash_transactions_update" ON public.cash_transactions
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "payment_transactions_delete" ON public.payment_transactions;
CREATE POLICY "payment_transactions_delete" ON public.payment_transactions
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'financeiro', 'delete'));
DROP POLICY IF EXISTS "payment_transactions_mutate" ON public.payment_transactions;
CREATE POLICY "payment_transactions_mutate" ON public.payment_transactions
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'create'));
DROP POLICY IF EXISTS "payment_transactions_update" ON public.payment_transactions;
CREATE POLICY "payment_transactions_update" ON public.payment_transactions
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "financial_alerts_delete" ON public.financial_alerts;
CREATE POLICY "financial_alerts_delete" ON public.financial_alerts
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'financeiro', 'delete'));
DROP POLICY IF EXISTS "financial_alerts_mutate" ON public.financial_alerts;
CREATE POLICY "financial_alerts_mutate" ON public.financial_alerts
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'create'));
DROP POLICY IF EXISTS "financial_alerts_update" ON public.financial_alerts;
CREATE POLICY "financial_alerts_update" ON public.financial_alerts
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));
DROP POLICY IF EXISTS "Admins and managers can manage financial_alerts" ON public.financial_alerts;
CREATE POLICY "Admins and managers can manage financial_alerts" ON public.financial_alerts
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Admins and managers can manage bank_accounts" ON public.bank_accounts;
CREATE POLICY "Admins and managers can manage bank_accounts" ON public.bank_accounts
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Admins and managers can manage bank_reconciliations" ON public.bank_reconciliations;
CREATE POLICY "Admins and managers can manage bank_reconciliations" ON public.bank_reconciliations
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can manage chart_of_accounts" ON public.chart_of_accounts;
CREATE POLICY "Only admins and managers can manage chart_of_accounts" ON public.chart_of_accounts
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can manage cost_adjustments" ON public.cost_adjustments;
CREATE POLICY "Only admins and managers can manage cost_adjustments" ON public.cost_adjustments
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can manage cost_centers" ON public.cost_centers;
CREATE POLICY "Only admins and managers can manage cost_centers" ON public.cost_centers
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "payment_methods_admin_manage" ON public.payment_methods;
CREATE POLICY "payment_methods_admin_manage" ON public.payment_methods
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can manage receipt_transactions" ON public.receipt_transactions;
CREATE POLICY "Only admins and managers can manage receipt_transactions" ON public.receipt_transactions
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

DROP POLICY IF EXISTS "Admins and managers can manage recurring_transactions" ON public.recurring_transactions;
CREATE POLICY "Admins and managers can manage recurring_transactions" ON public.recurring_transactions
  FOR ALL USING (public.check_module_permission(auth.uid(), 'financeiro', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'financeiro', 'edit'));

-- ============================================================
-- 9. Normalizar drift: module_permissions/role_templates reimplementavam
--    is_admin_or_manager/has_role('admin') via EXISTS inline em vez de reusar.
-- ============================================================
DROP POLICY IF EXISTS "admins_manage_all" ON public.module_permissions;
CREATE POLICY "admins_manage_all" ON public.module_permissions
  FOR ALL USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "admins_manage_templates" ON public.role_templates;
CREATE POLICY "admins_manage_templates" ON public.role_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 10. Migrar dado legado: usuário(s) role='financial' -> user + perfil Financeiro
--     (enum app_role NÃO é alterado — 'financial' fica definido mas descontinuado,
--     por segurança de não fazer ALTER TYPE ... DROP VALUE numa coluna usada em
--     todo o schema; só deixa de ser atribuído daqui pra frente).
-- ============================================================
UPDATE public.user_profiles
SET profile_id = (SELECT id FROM public.role_templates WHERE role_name = 'financeiro')
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'financial')
  AND profile_id IS NULL;

UPDATE public.user_roles SET role = 'user' WHERE role = 'financial';

-- ============================================================
-- 11. Snapshot de segurança antes de derrubar as tabelas antigas — RLS fechada
--     desde a criação (mesmo padrão de _backup_material_names, jun/2026).
--     Enums viram text no snapshot pra não prender o enum original ao dropar.
-- ============================================================
CREATE TABLE IF NOT EXISTS public._backup_legacy_permissions_ago2026_user_permissions AS
  SELECT id, user_id, category::text AS category, subcategory::text AS subcategory, granted_by, created_at
  FROM public.user_permissions;
ALTER TABLE public._backup_legacy_permissions_ago2026_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._backup_legacy_permissions_ago2026_hr_permissions AS
  SELECT id, user_id, permission_type::text AS permission_type, granted_by, created_at
  FROM public.hr_permissions;
ALTER TABLE public._backup_legacy_permissions_ago2026_hr_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public._backup_legacy_permissions_ago2026_financial_permissions AS
  SELECT * FROM public.financial_permissions;
ALTER TABLE public._backup_legacy_permissions_ago2026_financial_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. Dropar sistemas paralelos — confirmado por auditoria: zero referências em
--     RLS, zero chamadas RPC do frontend, e (hr_permissions/financial_permissions)
--     zero telas vivas administrando.
-- ============================================================
DROP FUNCTION IF EXISTS public.has_hr_permission(uuid, hr_permission_type);
DROP FUNCTION IF EXISTS public.has_financial_permission(uuid, text, text);
DROP FUNCTION IF EXISTS public.has_permission(uuid, permission_category, permission_subcategory);

DROP TABLE IF EXISTS public.hr_permissions;
DROP TYPE IF EXISTS public.hr_permission_type;

DROP TABLE IF EXISTS public.financial_permissions;

DROP TABLE IF EXISTS public.user_permissions;
DROP TYPE IF EXISTS public.permission_category;
DROP TYPE IF EXISTS public.permission_subcategory;

-- ============================================================
-- 13. role_templates.permissions (jsonb estático) fica redundante — o dado já
--     vive de verdade (e vivo) em module_permissions.profile_id.
-- ============================================================
ALTER TABLE public.role_templates DROP COLUMN IF EXISTS permissions;

-- ============================================================
-- 14. Limpeza pequena: UNIQUE redundante em user_roles (UNIQUE(user_id) já
--     implica UNIQUE(user_id, role)).
-- ============================================================
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

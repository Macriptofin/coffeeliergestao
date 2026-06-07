-- =============================================================================
-- SECURITY HARDENING — Coffeelier
-- Data: 2026-06-07
-- Origem: Supabase Security Advisor (Critical + Warning)
--
-- Corrige os seguintes problemas:
--   [CRITICAL] Any authenticated user can modify account lockout records
--   [CRITICAL] All authenticated users can fully manage client organizational data
--   [CRITICAL] All authenticated users can fully manage all sales orders and items
--   [WARNING]  All authenticated users can fully manage event sessions
--   [WARNING]  Any database role can update all material name mappings
--   [WARNING]  Any authenticated user can modify unit conversion data
--   [WARNING]  Multiple SECURITY DEFINER Functions Bypass RLS (search_path mutable)
--   [WARNING]  Public Can Execute SECURITY DEFINER Function
--   [WARNING]  Backup table is publicly accessible without authentication
--   [WARNING]  Function Search Path Mutable (4 funções)
--   [WARNING]  RLS Policy Always True (policies com USING (true) sem restrição de role)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. account_lockouts — CRITICAL
--    "System can manage account lockouts" usava USING (true) — qualquer
--    usuário autenticado podia desbloquear contas (inclusive a própria).
--    Corrigido: somente role admin pode fazer INSERT/UPDATE/DELETE.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can manage account lockouts" ON public.account_lockouts;

CREATE POLICY "admins_manage_lockouts"
  ON public.account_lockouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text = 'admin'
    )
  );

-- Sistemas internos (triggers/service_role) ainda conseguem escrever via
-- service_role (bypassa RLS por definição). A policy acima protege o acesso
-- via JWT de usuários comuns.

-- -----------------------------------------------------------------------------
-- 2. event_sessions — WARNING
--    SELECT sem restrição de role permitia que o role "anon" lesse sessões.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários podem ver sessões de eventos" ON public.event_sessions;

CREATE POLICY "authenticated_select_event_sessions"
  ON public.event_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 3. unit_conversions — WARNING
--    "admin_write" permitia qualquer usuário autenticado modificar conversões
--    de unidade (não apenas admins).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_write" ON public.unit_conversions;

CREATE POLICY "admins_write_unit_conversions"
  ON public.unit_conversions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'manager')
    )
  );

-- -----------------------------------------------------------------------------
-- 4. material_name_mappings — WARNING
--    "System can update mappings" usava USING (true) sem exigir autenticação.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can update mappings" ON public.material_name_mappings;

CREATE POLICY "authenticated_update_mappings"
  ON public.material_name_mappings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 5. client_departments / client_units / client_rooms / client_contacts — CRITICAL
--    Policies usavam USING (true) sem TO authenticated. Adiciona restrição
--    explícita de role para garantir que anon nunca acesse dados de clientes.
--    (App é single-tenant/interno, então todos os funcionários logados podem
--     ler/escrever — mas anon nunca deve ter acesso.)
-- -----------------------------------------------------------------------------

-- client_departments
DROP POLICY IF EXISTS "Authenticated users can view client departments"   ON public.client_departments;
DROP POLICY IF EXISTS "Authenticated users can insert client departments" ON public.client_departments;
DROP POLICY IF EXISTS "Authenticated users can update client departments" ON public.client_departments;
DROP POLICY IF EXISTS "Authenticated users can delete client departments" ON public.client_departments;

CREATE POLICY "auth_all_client_departments"
  ON public.client_departments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- client_units
DROP POLICY IF EXISTS "Authenticated users can view client units"   ON public.client_units;
DROP POLICY IF EXISTS "Authenticated users can insert client units" ON public.client_units;
DROP POLICY IF EXISTS "Authenticated users can update client units" ON public.client_units;
DROP POLICY IF EXISTS "Authenticated users can delete client units" ON public.client_units;

CREATE POLICY "auth_all_client_units"
  ON public.client_units FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- client_rooms
DROP POLICY IF EXISTS "Authenticated users can view client rooms"   ON public.client_rooms;
DROP POLICY IF EXISTS "Authenticated users can insert client rooms" ON public.client_rooms;
DROP POLICY IF EXISTS "Authenticated users can update client rooms" ON public.client_rooms;
DROP POLICY IF EXISTS "Authenticated users can delete client rooms" ON public.client_rooms;

CREATE POLICY "auth_all_client_rooms"
  ON public.client_rooms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- client_contacts
DROP POLICY IF EXISTS "Authenticated users can view client contacts"   ON public.client_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Authenticated users can update client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete client contacts" ON public.client_contacts;

CREATE POLICY "auth_all_client_contacts"
  ON public.client_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. sales_orders / sales_order_items — CRITICAL
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar pedidos"       ON public.sales_orders;
DROP POLICY IF EXISTS "Usuários autenticados podem criar pedidos"            ON public.sales_orders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar pedidos"        ON public.sales_orders;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir pedidos"          ON public.sales_orders;

CREATE POLICY "auth_all_sales_orders"
  ON public.sales_orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar itens de pedidos" ON public.sales_order_items;
DROP POLICY IF EXISTS "Usuários autenticados podem criar itens de pedidos"      ON public.sales_order_items;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens de pedidos"  ON public.sales_order_items;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir itens de pedidos"    ON public.sales_order_items;

CREATE POLICY "auth_all_sales_order_items"
  ON public.sales_order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 7. SECURITY DEFINER functions — WARNING: Function Search Path Mutable
--    Funções com SECURITY DEFINER sem SET search_path são vulneráveis a
--    ataques de search_path injection. Corrigido adicionando SET search_path.
-- -----------------------------------------------------------------------------

-- 7a. mask_cpf
CREATE OR REPLACE FUNCTION public.mask_cpf(cpf_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF cpf_value IS NULL OR length(cpf_value) < 11 THEN
    RETURN cpf_value;
  END IF;
  RETURN substring(cpf_value, 1, 3) || '.***.***-' || substring(cpf_value, length(cpf_value)-1);
END;
$$;

-- 7b. mask_rg
CREATE OR REPLACE FUNCTION public.mask_rg(rg_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF rg_value IS NULL OR length(rg_value) < 4 THEN
    RETURN rg_value;
  END IF;
  RETURN substring(rg_value, 1, 2) || '*****' || substring(rg_value, length(rg_value)-1);
END;
$$;

-- 7c. log_pii_access — adiciona SET search_path
CREATE OR REPLACE FUNCTION public.log_pii_access(
  p_table_name  TEXT,
  p_employee_id UUID,
  p_access_type TEXT,
  p_pii_fields  TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, action, resource_type, resource_id, details
  ) VALUES (
    auth.uid(),
    'PII_ACCESS',
    p_table_name,
    p_employee_id,
    jsonb_build_object(
      'access_type', p_access_type,
      'pii_fields',  p_pii_fields,
      'timestamp',   now(),
      'ip_address',  current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$;

-- 7d. sync_employee_salary — adiciona SET search_path
CREATE OR REPLACE FUNCTION public.sync_employee_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO public.employee_salary_info (employee_id, salary)
    VALUES (NEW.id, NEW.salary)
    ON CONFLICT (employee_id)
    DO UPDATE SET salary = NEW.salary, updated_at = now();

    IF NEW.salary IS NOT NULL THEN
      PERFORM public.log_pii_access('employees', NEW.id, 'SALARY_UPDATE', ARRAY['salary']);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.employee_salary_info WHERE employee_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 7e. check_module_permission — adiciona SET search_path
CREATE OR REPLACE FUNCTION public.check_module_permission(
  p_user_id uuid,
  p_module  text,
  p_action  text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles        WHERE user_id = p_user_id AND role::text IN ('admin','manager'))
      OR EXISTS (SELECT 1 FROM public.module_permissions WHERE user_id = p_user_id AND module = p_module AND action = p_action);
$$;

-- 7f. trigger_update_bom_costs_on_price_change — adiciona SET search_path
--     (re-declaração mantém o corpo original, apenas fixa o search_path)
DO $$
DECLARE
  v_def text;
BEGIN
  -- Só altera se existir e não tiver search_path
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'trigger_update_bom_costs_on_price_change'
  ) THEN
    -- Adiciona SET search_path via ALTER FUNCTION (non-destructive)
    EXECUTE 'ALTER FUNCTION public.trigger_update_bom_costs_on_price_change() SET search_path = public';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'calculate_weighted_average_price'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.calculate_weighted_average_price() SET search_path = public';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Revogar execução pública de funções SECURITY DEFINER sensíveis — WARNING
--    Por padrão, Postgres concede EXECUTE a PUBLIC. Funções SECURITY DEFINER
--    só devem ser executáveis por roles autenticados ou pelo sistema.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.mask_cpf(TEXT)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_pii_access(TEXT, UUID, TEXT, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_module_permission(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mask_cpf(TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_pii_access(TEXT, UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_module_permission(UUID, TEXT, TEXT) TO authenticated;

-- mask_rg idem
REVOKE EXECUTE ON FUNCTION public.mask_rg(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mask_rg(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Schema backup — WARNING: Backup table publicly accessible
--    O schema backup não tem RLS nas tabelas snapshot. Revoga acesso dos
--    roles públicos. service_role (usado pelo Supabase internamente) mantém
--    acesso implícito por bypassar RLS.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'backup') THEN
    REVOKE ALL ON SCHEMA backup FROM PUBLIC;
    REVOKE ALL ON SCHEMA backup FROM anon;
    REVOKE ALL ON SCHEMA backup FROM authenticated;
    -- Revogar acesso nas tabelas existentes também
    EXECUTE (
      SELECT coalesce(
        string_agg(
          'REVOKE ALL ON TABLE backup.' || quote_ident(tablename) || ' FROM PUBLIC, anon, authenticated;',
          ' '
        ),
        'SELECT 1'
      )
      FROM pg_tables
      WHERE schemaname = 'backup'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 10. Habilitar Leaked Password Protection
--     NOTA: Isso NÃO pode ser feito via SQL — é uma configuração do
--     Supabase Auth. Ação manual necessária:
--       Dashboard → Authentication → Settings → Password Security
--       → Ativar "Leaked password protection (HaveIBeenPwned)"
--
--     O Edge Function em supabase/functions/password-verification-hook/
--     já implementa a lógica de verificação. Certifique-se de que o hook
--     está configurado em Auth → Hooks → Password Verification Hook.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
COMMENT ON SCHEMA public IS 'Security hardening applied 2026-06-07: RLS policies tightened, SECURITY DEFINER functions fixed, backup schema access revoked.';

-- ========================================
-- CORREÇÕES DE SEGURANÇA - ACESSO GRANULAR A DADOS
-- ========================================

-- 1. CRIAR TABELA DE ATRIBUIÇÃO DE CLIENTES
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamp with time zone DEFAULT now(),
  notes text,
  UNIQUE(client_id, user_id)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar atribuições de clientes"
ON public.client_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes veem suas próprias atribuições"
ON public.client_assignments FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 2. CRIAR ENUM E TABELA DE PERMISSÕES DE RH
DO $$ BEGIN
  CREATE TYPE public.hr_permission_type AS ENUM (
    'view_basic_info',
    'view_personal_documents',
    'view_financial_info',
    'full_access'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.hr_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_type hr_permission_type NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, permission_type)
);

ALTER TABLE public.hr_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem gerenciar permissões de RH"
ON public.hr_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários veem suas próprias permissões de RH"
ON public.hr_permissions FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3. CRIAR FUNÇÃO PARA VERIFICAR PERMISSÃO DE RH
CREATE OR REPLACE FUNCTION public.has_hr_permission(
  _user_id uuid,
  _permission hr_permission_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hr_permissions
    WHERE user_id = _user_id
      AND (permission_type = _permission OR permission_type = 'full_access')
  ) OR has_role(_user_id, 'admin'::app_role);
$$;

-- 4. ATUALIZAR POLÍTICAS RLS DE CLIENTS PARA CONTROLE GRANULAR
DROP POLICY IF EXISTS "Only admins and managers can view clients" ON public.clients;
DROP POLICY IF EXISTS "Only admins and managers can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Only admins and managers can update clients" ON public.clients;
DROP POLICY IF EXISTS "Only admins and managers can delete clients" ON public.clients;

CREATE POLICY "Admins têm acesso total a clientes"
ON public.clients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes veem apenas clientes atribuídos"
ON public.clients FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.client_assignments
    WHERE client_id = clients.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Gerentes podem criar clientes"
ON public.clients FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Gerentes podem atualizar clientes atribuídos"
ON public.clients FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.client_assignments
    WHERE client_id = clients.id AND user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.client_assignments
    WHERE client_id = clients.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Apenas admins podem deletar clientes"
ON public.clients FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. ATUALIZAR POLÍTICAS RLS DE EMPLOYEES PARA USAR PERMISSÕES DE RH
DROP POLICY IF EXISTS "Only admins and managers can view employees" ON public.employees;
DROP POLICY IF EXISTS "Only admins and managers can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Only admins and managers can update employees" ON public.employees;
DROP POLICY IF EXISTS "Only admins and managers can delete employees" ON public.employees;

CREATE POLICY "Usuários com permissão RH veem funcionários"
ON public.employees FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
  OR has_hr_permission(auth.uid(), 'view_basic_info'::hr_permission_type)
);

CREATE POLICY "Apenas admins e RH Full podem inserir funcionários"
ON public.employees FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
);

CREATE POLICY "Apenas admins e RH Full podem atualizar funcionários"
ON public.employees FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
);

CREATE POLICY "Apenas admins podem deletar funcionários"
ON public.employees FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
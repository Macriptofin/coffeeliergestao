-- Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Criar tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Criar função para verificar se usuário é admin ou manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- Remover política atual da tabela suppliers
DROP POLICY IF EXISTS "Manage suppliers (auth only)" ON public.suppliers;

-- Criar novas políticas restritivas para suppliers
CREATE POLICY "Only admins and managers can view suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert suppliers"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update suppliers"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (public.is_admin_or_manager(auth.uid()))
WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete suppliers"
ON public.suppliers
FOR DELETE
TO authenticated
USING (public.is_admin_or_manager(auth.uid()));

-- Política para user_roles - usuários podem ver seus próprios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Apenas admins podem gerenciar roles
CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir um usuário admin inicial (usando um UUID placeholder - será necessário substituir pelo ID real do usuário)
-- Este será comentado para que seja feito manualmente após a autenticação estar configurada
-- INSERT INTO public.user_roles (user_id, role) VALUES ('PLACEHOLDER_USER_ID', 'admin');
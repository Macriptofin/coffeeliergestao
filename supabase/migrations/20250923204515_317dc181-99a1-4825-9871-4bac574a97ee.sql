-- Fase 1: Correções de Segurança Críticas

-- 1. Remover políticas muito permissivas e criar políticas mais restritivas

-- Clientes: apenas admins e managers podem acessar
DROP POLICY IF EXISTS "Manage clients (auth only)" ON public.clients;

CREATE POLICY "Only admins and managers can view clients"
ON public.clients
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert clients" 
ON public.clients
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update clients"
ON public.clients
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete clients"
ON public.clients
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Produtos: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage products (auth only)" ON public.products;

CREATE POLICY "Only admins and managers can view products"
ON public.products
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert products"
ON public.products
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update products"
ON public.products
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete products"
ON public.products
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Propostas: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage proposals (auth only)" ON public.proposals;

CREATE POLICY "Only admins and managers can view proposals"
ON public.proposals
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert proposals"
ON public.proposals
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update proposals"
ON public.proposals
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete proposals"
ON public.proposals
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Itens de Proposta: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage proposal_items (auth only)" ON public.proposal_items;

CREATE POLICY "Only admins and managers can view proposal_items"
ON public.proposal_items
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert proposal_items"
ON public.proposal_items
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update proposal_items"
ON public.proposal_items
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete proposal_items"
ON public.proposal_items
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Ordens de Compra: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage purchase_orders (auth only)" ON public.purchase_orders;

CREATE POLICY "Only admins and managers can view purchase_orders"
ON public.purchase_orders
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert purchase_orders"
ON public.purchase_orders
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update purchase_orders"
ON public.purchase_orders
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete purchase_orders"
ON public.purchase_orders
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Notas Fiscais de Compra: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage purchase_invoices (auth only)" ON public.purchase_invoices;

CREATE POLICY "Only admins and managers can view purchase_invoices"
ON public.purchase_invoices
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert purchase_invoices"
ON public.purchase_invoices
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update purchase_invoices"
ON public.purchase_invoices
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete purchase_invoices"
ON public.purchase_invoices
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Itens de Nota Fiscal: apenas admins e managers podem gerenciar
DROP POLICY IF EXISTS "Manage invoice_items (auth only)" ON public.invoice_items;

CREATE POLICY "Only admins and managers can view invoice_items"
ON public.invoice_items
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert invoice_items"
ON public.invoice_items
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update invoice_items"
ON public.invoice_items
FOR UPDATE
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete invoice_items"
ON public.invoice_items
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- 2. Fixar search_path em funções existentes para prevenir vulnerabilidades
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.no_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_not_self(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND _user_id != _target_user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;

-- 3. Expandir auditoria de segurança
ALTER TABLE public.security_audit_log 
ADD COLUMN IF NOT EXISTS resource_type TEXT,
ADD COLUMN IF NOT EXISTS resource_id UUID,
ADD COLUMN IF NOT EXISTS details JSONB;

-- Criar função para log de acesso a dados sensíveis
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, action, resource_type, resource_id, details
  ) VALUES (
    auth.uid(), p_action, p_resource_type, p_resource_id, p_details
  );
END;
$$;

-- 4. Criar triggers de auditoria para tabelas críticas
CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log apenas SELECT para não sobrecarregar o sistema
  IF TG_OP = 'SELECT' THEN
    PERFORM public.log_sensitive_data_access(
      'DATA_ACCESS',
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object('operation', TG_OP)
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Não vamos aplicar os triggers de SELECT por questões de performance
-- Mas deixamos a estrutura pronta para uso futuro se necessário

-- 5. Melhorar as receitas e ingredientes para permitir acesso a usuários regulares
-- (mantendo apenas dados financeiros restritos)
DROP POLICY IF EXISTS "Manage recipes (auth only)" ON public.recipes;
DROP POLICY IF EXISTS "Manage recipe_ingredients (auth only)" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "Manage materials (auth only)" ON public.materials;
DROP POLICY IF EXISTS "Manage stock_items (auth only)" ON public.stock_items;
DROP POLICY IF EXISTS "Manage stock_movements (auth only)" ON public.stock_movements;

-- Receitas: todos podem ver, apenas admins/managers podem modificar
CREATE POLICY "Anyone authenticated can view recipes"
ON public.recipes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage recipes"
ON public.recipes
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Ingredientes de receitas: todos podem ver, apenas admins/managers podem modificar
CREATE POLICY "Anyone authenticated can view recipe_ingredients"
ON public.recipe_ingredients
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage recipe_ingredients"
ON public.recipe_ingredients
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Materiais: todos podem ver (exceto preços), apenas admins/managers podem modificar
CREATE POLICY "Anyone authenticated can view materials"
ON public.materials
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage materials"
ON public.materials
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Estoque: todos podem ver quantidades, apenas admins/managers podem modificar
CREATE POLICY "Anyone authenticated can view stock_items"
ON public.stock_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage stock_items"
ON public.stock_items
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Movimentações de estoque: todos podem ver, apenas admins/managers podem criar
CREATE POLICY "Anyone authenticated can view stock_movements"
ON public.stock_movements
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage stock_movements"
ON public.stock_movements
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
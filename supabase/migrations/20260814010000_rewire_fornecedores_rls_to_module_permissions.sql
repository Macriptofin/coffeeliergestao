-- Mesmo achado do módulo Compras (migration 20260813210000): "Fornecedores"
-- também ficou de fora da consolidação de acesso original. O perfil
-- "Compras" da Daniela já concede fornecedores/view+create (confirmado via
-- check_module_permission), mas suppliers/supplier_products ainda travavam
-- tudo em is_admin_or_manager().
DROP POLICY IF EXISTS "Only admins and managers can view suppliers" ON public.suppliers;
CREATE POLICY "Only admins and managers can view suppliers" ON public.suppliers
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'fornecedores', 'view'));

DROP POLICY IF EXISTS "Only admins and managers can insert suppliers" ON public.suppliers;
CREATE POLICY "Only admins and managers can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'fornecedores', 'create'));

DROP POLICY IF EXISTS "Only admins and managers can update suppliers" ON public.suppliers;
CREATE POLICY "Only admins and managers can update suppliers" ON public.suppliers
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'fornecedores', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'fornecedores', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can delete suppliers" ON public.suppliers;
CREATE POLICY "Only admins and managers can delete suppliers" ON public.suppliers
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'fornecedores', 'delete'));

DROP POLICY IF EXISTS "Only admins and managers can view supplier_products" ON public.supplier_products;
CREATE POLICY "Only admins and managers can view supplier_products" ON public.supplier_products
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'fornecedores', 'view'));

DROP POLICY IF EXISTS "Only admins and managers can insert supplier_products" ON public.supplier_products;
CREATE POLICY "Only admins and managers can insert supplier_products" ON public.supplier_products
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'fornecedores', 'create'));

DROP POLICY IF EXISTS "Only admins and managers can update supplier_products" ON public.supplier_products;
CREATE POLICY "Only admins and managers can update supplier_products" ON public.supplier_products
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'fornecedores', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'fornecedores', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can delete supplier_products" ON public.supplier_products;
CREATE POLICY "Only admins and managers can delete supplier_products" ON public.supplier_products
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'fornecedores', 'delete'));

-- O módulo Compras ficou de fora da consolidação de acesso (migration
-- 20260813180000, que só rewired RH e Financeiro) — as ~13 tabelas do módulo
-- ainda travavam tudo em is_admin_or_manager(), ignorando "Perfil de Acesso"
-- completamente. Achado real: usuária com perfil "Compras" corretamente
-- configurado não conseguia acessar Notas Fiscais. check_module_permission()
-- já inclui bypass de admin/manager por dentro, então a troca é direta.

-- 1. purchase_invoices (já granular por comando — só troca a função)
DROP POLICY IF EXISTS "Only admins and managers can view purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Only admins and managers can view purchase_invoices" ON public.purchase_invoices
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));

DROP POLICY IF EXISTS "Only admins and managers can insert purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Only admins and managers can insert purchase_invoices" ON public.purchase_invoices
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));

DROP POLICY IF EXISTS "Only admins and managers can update purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Only admins and managers can update purchase_invoices" ON public.purchase_invoices
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can delete purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Only admins and managers can delete purchase_invoices" ON public.purchase_invoices
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

-- 2. invoice_items (mesmo padrão)
DROP POLICY IF EXISTS "Only admins and managers can view invoice_items" ON public.invoice_items;
CREATE POLICY "Only admins and managers can view invoice_items" ON public.invoice_items
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));

DROP POLICY IF EXISTS "Only admins and managers can insert invoice_items" ON public.invoice_items;
CREATE POLICY "Only admins and managers can insert invoice_items" ON public.invoice_items
  FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));

DROP POLICY IF EXISTS "Only admins and managers can update invoice_items" ON public.invoice_items;
CREATE POLICY "Only admins and managers can update invoice_items" ON public.invoice_items
  FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit'))
  WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));

DROP POLICY IF EXISTS "Only admins and managers can delete invoice_items" ON public.invoice_items;
CREATE POLICY "Only admins and managers can delete invoice_items" ON public.invoice_items
  FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

-- 3. invoice_supplier_matches (só a SELECT estava travada; INSERT/UPDATE já
--    eram abertos a qualquer autenticado, deixados como estão)
DROP POLICY IF EXISTS "Only authenticated users can view invoice supplier matches" ON public.invoice_supplier_matches;
CREATE POLICY "Only authenticated users can view invoice supplier matches" ON public.invoice_supplier_matches
  FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));

-- 4-13. Tabelas com uma única policy ALL — dividir em 4 granulares (view/
-- create/edit/delete), igual à disciplina já usada em RH/Financeiro.
DROP POLICY IF EXISTS "Admins and managers can manage purchase_orders" ON public.purchase_orders;
CREATE POLICY "compras_select_purchase_orders" ON public.purchase_orders FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_purchase_orders" ON public.purchase_orders FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_purchase_orders" ON public.purchase_orders FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_purchase_orders" ON public.purchase_orders FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "compras_select_purchase_order_items" ON public.purchase_order_items FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_purchase_order_items" ON public.purchase_order_items FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_purchase_order_items" ON public.purchase_order_items FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_purchase_order_items" ON public.purchase_order_items FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage purchase_requests" ON public.purchase_requests;
CREATE POLICY "compras_select_purchase_requests" ON public.purchase_requests FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_purchase_requests" ON public.purchase_requests FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_purchase_requests" ON public.purchase_requests FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_purchase_requests" ON public.purchase_requests FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage purchase_requirements" ON public.purchase_requirements;
CREATE POLICY "compras_select_purchase_requirements" ON public.purchase_requirements FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_purchase_requirements" ON public.purchase_requirements FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_purchase_requirements" ON public.purchase_requirements FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_purchase_requirements" ON public.purchase_requirements FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage quote_requests" ON public.quote_requests;
CREATE POLICY "compras_select_quote_requests" ON public.quote_requests FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_quote_requests" ON public.quote_requests FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_quote_requests" ON public.quote_requests FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_quote_requests" ON public.quote_requests FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage quote_request_items" ON public.quote_request_items;
CREATE POLICY "compras_select_quote_request_items" ON public.quote_request_items FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_quote_request_items" ON public.quote_request_items FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_quote_request_items" ON public.quote_request_items FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_quote_request_items" ON public.quote_request_items FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage quote_request_suppliers" ON public.quote_request_suppliers;
CREATE POLICY "compras_select_quote_request_suppliers" ON public.quote_request_suppliers FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_quote_request_suppliers" ON public.quote_request_suppliers FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_quote_request_suppliers" ON public.quote_request_suppliers FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_quote_request_suppliers" ON public.quote_request_suppliers FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage supplier_quotes" ON public.supplier_quotes;
CREATE POLICY "compras_select_supplier_quotes" ON public.supplier_quotes FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_supplier_quotes" ON public.supplier_quotes FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_supplier_quotes" ON public.supplier_quotes FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_supplier_quotes" ON public.supplier_quotes FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage supplier_quote_items" ON public.supplier_quote_items;
CREATE POLICY "compras_select_supplier_quote_items" ON public.supplier_quote_items FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_supplier_quote_items" ON public.supplier_quote_items FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_supplier_quote_items" ON public.supplier_quote_items FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_supplier_quote_items" ON public.supplier_quote_items FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage stock_parameters" ON public.stock_parameters;
CREATE POLICY "compras_select_stock_parameters" ON public.stock_parameters FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_stock_parameters" ON public.stock_parameters FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_stock_parameters" ON public.stock_parameters FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_stock_parameters" ON public.stock_parameters FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

DROP POLICY IF EXISTS "Admins and managers can manage stock_planning_results" ON public.stock_planning_results;
CREATE POLICY "compras_select_stock_planning_results" ON public.stock_planning_results FOR SELECT USING (public.check_module_permission(auth.uid(), 'compras', 'view'));
CREATE POLICY "compras_insert_stock_planning_results" ON public.stock_planning_results FOR INSERT WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'create'));
CREATE POLICY "compras_update_stock_planning_results" ON public.stock_planning_results FOR UPDATE USING (public.check_module_permission(auth.uid(), 'compras', 'edit')) WITH CHECK (public.check_module_permission(auth.uid(), 'compras', 'edit'));
CREATE POLICY "compras_delete_stock_planning_results" ON public.stock_planning_results FOR DELETE USING (public.check_module_permission(auth.uid(), 'compras', 'delete'));

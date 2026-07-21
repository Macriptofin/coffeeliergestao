-- purchase_orders tinha 5 policies sobrepostas (4 CRUD separadas de 23/set + 1
-- FOR ALL de 29/set redundante) — todas is_admin_or_manager, inofensivas mas
-- confusas. Consolida numa só. purchase_order_items só tinha SELECT — o insert
-- que o fluxo de "Criar Pedido de Compra" precisa fazer falharia em silêncio
-- (mesmo bug já corrigido em stock_planning_results nesta sessão).

DROP POLICY IF EXISTS "Admins and managers can manage purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only admins and managers can delete purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only admins and managers can insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only admins and managers can update purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Only admins and managers can view purchase_orders" ON public.purchase_orders;

CREATE POLICY "Admins and managers can manage purchase_orders"
ON public.purchase_orders FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can view purchase_order_items" ON public.purchase_order_items;

CREATE POLICY "Admins and managers can manage purchase_order_items"
ON public.purchase_order_items FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

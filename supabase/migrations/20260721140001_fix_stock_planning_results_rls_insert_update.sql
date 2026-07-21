-- stock_planning_results só tinha policy de SELECT — o insert(results) que
-- StockPlanning.tsx já tenta fazer falharia silenciosamente por RLS assim que
-- houvesse qualquer linha em stock_parameters gerando resultado. Substitui pela
-- mesma policy FOR ALL das tabelas irmãs (stock_parameters/stock_planning_runs).
DROP POLICY "Admins and managers can view stock_planning_results" ON public.stock_planning_results;

CREATE POLICY "Admins and managers can manage stock_planning_results"
ON public.stock_planning_results FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

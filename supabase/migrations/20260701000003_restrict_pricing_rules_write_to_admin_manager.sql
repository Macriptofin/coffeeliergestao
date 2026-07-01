-- Advisor WARN rls_policy_always_true: pricing_rules tinha 1 única policy
-- (ALL, USING/WITH CHECK sempre true) liberando qualquer usuário autenticado
-- a criar/editar/apagar regras de margem/overhead por categoria — que
-- alimentam o preço sugerido de todo o catálogo vendável. Alinhando ao
-- mesmo padrão já usado em materials/app_settings: leitura livre para
-- autenticados, escrita restrita a admin/manager via is_admin_or_manager().
DROP POLICY IF EXISTS pricing_rules_all ON public.pricing_rules;

CREATE POLICY "Anyone authenticated can view pricing_rules"
  ON public.pricing_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage pricing_rules"
  ON public.pricing_rules FOR ALL
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

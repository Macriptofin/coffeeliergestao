-- Advisor WARN function_search_path_mutable (14 funções): sem SET search_path
-- fixo, a função resolve nomes de objeto (tabelas, outras funções) pelo
-- search_path da SESSÃO de quem chama, que pode ser manipulado — risco de
-- "schema injection" se alguém criar um objeto de mesmo nome em outro schema
-- antes de public no seu próprio search_path. Regra já documentada no
-- CLAUDE.md ("toda função SECURITY DEFINER deve ter SET search_path=public");
-- aplicando aqui em todas (não só as SECURITY DEFINER) por ser a correção
-- correta e sem custo.
ALTER FUNCTION public.check_module_permission(uuid,text,text) SET search_path = public;
ALTER FUNCTION public.count_unread_alerts() SET search_path = public;
ALTER FUNCTION public.default_competence_date() SET search_path = public;
ALTER FUNCTION public.fn_check_proposal_alert() SET search_path = public;
ALTER FUNCTION public.fn_check_stock_alert() SET search_path = public;
ALTER FUNCTION public.generate_client_code() SET search_path = public;
ALTER FUNCTION public.generate_order_number() SET search_path = public;
ALTER FUNCTION public.get_conversion_factor(text,text) SET search_path = public;
ALTER FUNCTION public.mark_alert_read(uuid,uuid) SET search_path = public;
ALTER FUNCTION public.normalize_text(text) SET search_path = public;
ALTER FUNCTION public.reserve_stock_for_production_order() SET search_path = public;
ALTER FUNCTION public.title_case_ptbr(text) SET search_path = public;
ALTER FUNCTION public.update_invoice_ocr_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_stock_movement_reference() SET search_path = public;

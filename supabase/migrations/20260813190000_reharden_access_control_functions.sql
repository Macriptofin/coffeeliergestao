-- A reescrita de check_module_permission/has_financial_access (consolidação de
-- acesso em perfis, migration 20260813180000) resetou o GRANT dessas funções pro
-- padrão do Supabase: EXECUTE concedido explicitamente a anon/authenticated/
-- service_role em toda função nova ou CREATE OR REPLACE, desfazendo silenciosamente
-- o hardening de jul/2026 (que havia revogado de PUBLIC/anon pras ~110 funções
-- SECURITY DEFINER de mutação).
--
-- Achado ao vivo: REVOKE ... FROM PUBLIC sozinho é no-op aqui — o proacl mostrava
-- grant EXPLÍCITO a anon (não herdado de PUBLIC), então é preciso REVOKE ... FROM anon
-- direto. Mesma armadilha já documentada na auditoria de jul/2026.
REVOKE EXECUTE ON FUNCTION public.check_module_permission(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_module_permission(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_module_permission(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_financial_access(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_financial_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_financial_access(uuid) TO authenticated;

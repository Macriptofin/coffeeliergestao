-- A migration anterior (20260723170212) revogou EXECUTE de PUBLIC, mas o ACL real
-- (pg_proc.proacl) mostrou grant DIRETO pra anon/authenticated, não herdado de PUBLIC —
-- REVOKE FROM PUBLIC sozinho não bastou. Revogar explicitamente dos dois papéis.
REVOKE EXECUTE ON FUNCTION public.get_proposal_by_token(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_proposal_by_token(text) FROM anon, authenticated;

-- Achado real: useUserRole.tsx (fetchUserRole) resolve as permissões do
-- usuário lendo module_permissions diretamente do client (não via a RPC
-- check_module_permission, que é SECURITY DEFINER e bypassa RLS). A única
-- policy de SELECT existente pra usuários comuns era "users_see_own"
-- (user_id = auth.uid()), que só cobre exceções pessoais — não existia
-- nenhuma policy deixando um usuário comum ler as linhas do PRÓPRIO perfil
-- (profile_id). Resultado: can()/canView()/etc no frontend sempre retornava
-- false pra qualquer permissão vinda de perfil, pra qualquer usuário não
-- admin/manager — em todos os módulos, não só Compras. A RLS de aplicação
-- (ex.: purchase_invoices) usa a RPC e sempre funcionou certo; só a leitura
-- de "quais permissões eu tenho" pro frontend decidir o que mostrar é que
-- estava quebrada.
--
-- Permissões de perfil não são dado sensível (é só "o que o perfil X pode
-- fazer" — mesma natureza de role_templates, que já é público pra
-- autenticados via "authenticated_read_templates"). Abrir leitura geral
-- pras linhas de perfil (profile_id IS NOT NULL) resolve sem abrir as
-- linhas de exceção de outros usuários (essas continuam só via user_id).
CREATE POLICY "authenticated_read_profile_grants" ON public.module_permissions
  FOR SELECT USING (profile_id IS NOT NULL AND auth.role() = 'authenticated');

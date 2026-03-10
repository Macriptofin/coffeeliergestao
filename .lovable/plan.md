
## Avaliação completa do sistema de usuários

### O que foi analisado
Leitura de todos os componentes (`UsersList`, `UserForm`, `UserEditor`, `PermissionsSelector`), todas as Edge Functions (`create-user-with-invite`, `delete-user`, `admin-set-password`, `password-reset`) e as políticas RLS das tabelas `user_profiles`, `user_roles` e `user_permissions`.

---

### Resultado geral: o sistema funciona, mas há 3 problemas identificados

---

### Problema 1 — CRÍTICO: `user_profiles` não sincroniza email/confirmação automaticamente

**O que está ocorrendo:**
A tabela `user_profiles` tem colunas `email` e `email_confirmed_at`, mas elas são preenchidas apenas na criação via Edge Function. Se o usuário confirmar o email depois, ou se o email mudar, o `user_profiles` fica desatualizado — porque **não existe trigger** que sincronize esses dados vindos de `auth.users`.

**Impacto visível:** Na lista de usuários, o ícone de "email verificado" pode mostrar informação errada para usuários mais antigos.

**Correção planejada:** Criar uma migration com um trigger `AFTER UPDATE ON auth.users` que atualiza automaticamente `user_profiles.email` e `user_profiles.email_confirmed_at` quando o estado muda no Supabase Auth.

---

### Problema 2 — MÉDIO: Política RLS duplicada em `user_profiles`

**O que está ocorrendo:**
Existem **duas políticas SELECT e duas políticas UPDATE** sobrepostas na tabela `user_profiles`:
- `Users can view own profile` + `Users can view their own profile and admins can view all` → duplicadas
- `Users can update own profile` + `Users can update their own profile and admins can update all` → duplicadas

Além disso, a política INSERT `System can insert profiles` tem `WITH CHECK (true)` — qualquer usuário autenticado pode inserir perfis para qualquer `user_id`.

**Correção planejada:** Remover as policies duplicadas e restringir o INSERT para apenas o service_role ou admins.

---

### Problema 3 — BAIXO: Chamada desnecessária `getUser()` em `UsersList` (linha 41)

**O que está ocorrendo:**
`checkCurrentUserRole()` usa `supabase.auth.getUser()` (faz requisição de rede para `/auth/v1/user`) em vez de `getSession()` (usa cache local). O hook `useUserRole` já corrigiu isso, mas `UsersList` ainda usa o padrão antigo.

**Correção planejada:** Substituir `getUser()` por `getSession()` em `UsersList.tsx` linha 41.

---

### O que está funcionando corretamente ✅

| Funcionalidade | Status |
|---|---|
| Criar usuário com senha (admin define) | OK |
| Criar usuário por convite (email) | OK |
| Listar usuários | OK |
| Editar perfil (nome, display name) | OK |
| Alterar role (admin/manager/financial/user) | OK |
| Definir nova senha como admin | OK |
| Reset de senha por email | OK |
| Reenviar verificação de email | OK |
| Excluir usuário (com limpeza de dependências) | OK (corrigido na sessão anterior) |
| Permissões detalhadas por módulo | OK |
| Proteção anti-exclusão própria | OK |
| Proteção de acesso (somente admin) | OK |
| Banco de dados: 3 usuários cadastrados | OK (todos com email confirmado e role admin) |

---

### Plano de implementação

**1. Migration — sincronização automática de email no `user_profiles`**
```sql
-- Trigger que atualiza user_profiles quando auth.users muda
CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    email = NEW.email,
    email_confirmed_at = NEW.email_confirmed_at,
    updated_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_profile_email();
```

**2. Migration — limpar políticas RLS duplicadas e inseguras**
```sql
-- Remover duplicatas de SELECT
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON public.user_profiles;

-- Manter apenas a mais completa (inclui manager)
-- Já existe: "Users can view own profile" com (user_id = auth.uid()) OR admin OR manager

-- Remover duplicatas de UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile and admins can update all" ON public.user_profiles;

-- Recriar UPDATE unificada
CREATE POLICY "Users can update own profile or admins update all"
  ON public.user_profiles FOR UPDATE
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Remover INSERT permissivo (WITH CHECK true)
DROP POLICY IF EXISTS "System can insert profiles" ON public.user_profiles;
-- A política "Admins can insert user profiles" já existe e é suficiente
-- A criação via Edge Function usa service_role que bypassa RLS
```

**3. Código — substituir `getUser()` por `getSession()` em `UsersList.tsx`**
Linha 41: `const { data: { user } } = await supabase.auth.getUser();`
→ `const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;`

---

### Arquivos afetados
- Nova migration SQL (sincronização + limpeza RLS)
- `src/components/users/UsersList.tsx` (linha 41 e 114)

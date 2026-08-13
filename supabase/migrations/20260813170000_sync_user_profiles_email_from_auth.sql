-- Achado real (ago/2026): user_profiles.email/email_confirmed_at nunca eram
-- sincronizados com auth.users — nenhum trigger existia, e create-user-with-invite
-- (fluxo "admin cria com senha") nunca escrevia esses campos no upsert. Resultado:
-- a lista/edição de usuários caía no fallback visual `user-XXXXXXXX@system.local`
-- (UsersList.tsx) em vez do e-mail real — encontrado ao investigar a Daniela
-- (email real correto em auth.users: daniela@coffeelier.com.br, só não replicado).
-- Corrigido na raiz com um trigger, não só no código que cria usuário — cobre
-- qualquer caminho de criação/atualização de e-mail, presente ou futuro.

CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, email_confirmed_at)
  VALUES (NEW.id, NEW.email, NEW.email_confirmed_at)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_user_profile_email ON auth.users;
CREATE TRIGGER trg_sync_user_profile_email
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile_email();

-- Backfill de tudo que já estava dessincronizado (Daniela e qualquer outro).
UPDATE public.user_profiles up
SET email = au.email,
    email_confirmed_at = au.email_confirmed_at,
    updated_at = now()
FROM auth.users au
WHERE au.id = up.user_id
  AND (up.email IS DISTINCT FROM au.email
       OR up.email_confirmed_at IS DISTINCT FROM au.email_confirmed_at);

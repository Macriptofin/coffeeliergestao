
-- ================================================================
-- 1. Trigger: sincroniza email e email_confirmed_at em user_profiles
--    quando auth.users é atualizado (não modifica auth schema - apenas cria função em public)
-- ================================================================
CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    email              = NEW.email,
    email_confirmed_at = NEW.email_confirmed_at,
    updated_at         = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- ================================================================
-- 2. Limpar políticas RLS duplicadas em user_profiles
-- ================================================================
DROP POLICY IF EXISTS "Users can view own profile"                                    ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all"      ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"                                  ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile and admins can update all"  ON public.user_profiles;
DROP POLICY IF EXISTS "System can insert profiles"                                    ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert user profiles"                               ON public.user_profiles;

-- SELECT unificada: próprio usuário, admin ou manager
CREATE POLICY "user_profiles_select"
  ON public.user_profiles
  FOR SELECT
  USING (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- UPDATE unificada: próprio usuário ou admin
CREATE POLICY "user_profiles_update"
  ON public.user_profiles
  FOR UPDATE
  USING (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- INSERT: apenas admin (Edge Function usa service_role que bypassa RLS)
CREATE POLICY "user_profiles_insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

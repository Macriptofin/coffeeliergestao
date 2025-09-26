-- Adicionar campo email na tabela user_profiles para espelhar auth.users.email
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS email_confirmed_at timestamp with time zone;

-- Criar função para sincronizar dados do auth.users com user_profiles
CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Para novos usuários criados
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_profiles (user_id, email, email_confirmed_at)
    VALUES (NEW.id, NEW.email, NEW.email_confirmed_at)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = NEW.email,
      email_confirmed_at = NEW.email_confirmed_at,
      updated_at = now();
    
    RETURN NEW;
  END IF;
  
  -- Para atualizações de email ou confirmação
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles 
    SET 
      email = NEW.email,
      email_confirmed_at = NEW.email_confirmed_at,
      updated_at = now()
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Criar trigger para sincronizar automaticamente
DROP TRIGGER IF EXISTS sync_user_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_user_profile_email_trigger
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile_email();

-- Fazer backfill dos dados existentes
INSERT INTO public.user_profiles (user_id, email, email_confirmed_at, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  COALESCE(up.created_at, au.created_at),
  now()
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.user_id = au.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Atualizar perfis existentes com email do auth.users
UPDATE public.user_profiles 
SET 
  email = au.email,
  email_confirmed_at = au.email_confirmed_at,
  updated_at = now()
FROM auth.users au 
WHERE user_profiles.user_id = au.id 
AND (user_profiles.email IS NULL OR user_profiles.email != au.email);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_email ON public.user_profiles(user_id, email);
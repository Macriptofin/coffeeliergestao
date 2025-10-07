-- Criar função para processar convites e criar roles automaticamente
CREATE OR REPLACE FUNCTION public.handle_invite_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_role text;
BEGIN
  -- Extrair role dos metadados do usuário
  invited_role := NEW.raw_user_meta_data->>'invited_role';
  
  -- Se tem role de convite, criar a role
  IF invited_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invited_role::app_role)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;
    
    -- Log para debug
    RAISE NOTICE 'Role % criada para usuário %', invited_role, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger que roda APÓS a criação do perfil
-- Isso garante que user_profiles já existe quando criar a role
DROP TRIGGER IF EXISTS on_invite_user_created ON auth.users;
CREATE TRIGGER on_invite_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'invited_role' IS NOT NULL)
  EXECUTE FUNCTION public.handle_invite_signup();
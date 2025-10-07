-- Atualizar trigger sync_user_profile_email para popular full_name e display_name dos metadados
CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Para novos usuários criados
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_profiles (user_id, email, email_confirmed_at, full_name, display_name)
    VALUES (
      NEW.id, 
      NEW.email, 
      NEW.email_confirmed_at,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
      display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
      updated_at = now();
    
    RETURN NEW;
  END IF;
  
  -- Para atualizações de email ou confirmação
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.user_profiles 
    SET 
      email = NEW.email,
      email_confirmed_at = NEW.email_confirmed_at,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', user_profiles.full_name),
      display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', user_profiles.display_name),
      updated_at = now()
    WHERE user_id = NEW.id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;
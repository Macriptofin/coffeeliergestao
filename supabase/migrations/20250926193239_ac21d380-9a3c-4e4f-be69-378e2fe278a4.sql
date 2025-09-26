-- Fix security linter issues

-- Fix the security definer view by creating a proper function instead
DROP VIEW IF EXISTS public.secure_user_profiles;

-- Create a secure function with proper search path
CREATE OR REPLACE FUNCTION public.get_secure_user_profiles()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN p.email
      ELSE mask_email(p.email)
    END AS email,
    p.display_name,
    p.created_at,
    p.updated_at
  FROM public.user_profiles p
  WHERE p.user_id = auth.uid() 
     OR has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'manager');
END;
$$;

-- Fix search path for enhanced_security_audit function
CREATE OR REPLACE FUNCTION public.enhanced_security_audit()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log all operations on sensitive tables
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    TG_OP || '_' || upper(TG_TABLE_NAME),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old_values', to_jsonb(OLD),
      'new_values', to_jsonb(NEW),
      'timestamp', now()
    ),
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', true)::jsonb->>'user-agent'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix search path for sanitize_error_message function
CREATE OR REPLACE FUNCTION public.sanitize_error_message(error_msg text)
RETURNS text 
LANGUAGE plpgsql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove potentially sensitive information from error messages
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(error_msg, 
        '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 
        '[EMAIL_REDACTED]', 'g'),
      '\b\d{3}\.\d{3}\.\d{3}-\d{2}\b', 
      '[CPF_REDACTED]', 'g'),
    '\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b', 
    '[CNPJ_REDACTED]', 'g'
  );
END;
$$;
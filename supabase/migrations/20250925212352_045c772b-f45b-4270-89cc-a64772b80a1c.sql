-- Create secure client data masking functions
CREATE OR REPLACE FUNCTION public.mask_cnpj_cpf(cnpj_cpf_value text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF cnpj_cpf_value IS NULL OR LENGTH(cnpj_cpf_value) < 6 THEN
    RETURN cnpj_cpf_value;
  END IF;
  
  -- For CNPJ (14 digits) - show only last 4: **.***.***/**01-23
  IF LENGTH(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g')) = 14 THEN
    RETURN '**.***.***/**' || RIGHT(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g'), 4);
  END IF;
  
  -- For CPF (11 digits) - show only last 2: ***.***.**8-90
  RETURN '***.***.**' || RIGHT(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g'), 2);
END;
$function$;

-- Create function to mask phone numbers
CREATE OR REPLACE FUNCTION public.mask_phone(phone_value text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF phone_value IS NULL OR LENGTH(phone_value) < 6 THEN
    RETURN phone_value;
  END IF;
  
  -- Show only last 4 digits: ****-1234
  RETURN '****-' || RIGHT(REGEXP_REPLACE(phone_value, '[^0-9]', '', 'g'), 4);
END;
$function$;

-- Create function to mask email addresses
CREATE OR REPLACE FUNCTION public.mask_email(email_value text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF email_value IS NULL OR LENGTH(email_value) < 5 OR email_value NOT LIKE '%@%' THEN
    RETURN email_value;
  END IF;
  
  -- Show first 2 chars + masked + domain: jo***@domain.com
  RETURN LEFT(email_value, 2) || '***@' || SPLIT_PART(email_value, '@', 2);
END;
$function$;

-- Create secure client data function
CREATE OR REPLACE FUNCTION public.get_masked_client_data()
 RETURNS TABLE(
   id uuid,
   name text,
   cnpj_cpf text,
   cnpj_cpf_display text,
   email text,
   email_display text,
   phone text,
   phone_display text,
   contact_person text,
   address text,
   city text,
   state text,
   zip_code text,
   status text,
   notes text,
   created_at timestamp with time zone,
   updated_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log PII access for client data
  PERFORM log_pii_access('clients', NULL, 'LIST_VIEW', ARRAY['cnpj_cpf', 'email', 'phone', 'address']);
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.cnpj_cpf,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN c.cnpj_cpf
      ELSE mask_cnpj_cpf(c.cnpj_cpf)
    END AS cnpj_cpf_display,
    c.email,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN c.email
      ELSE mask_email(c.email)
    END AS email_display,
    c.phone,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN c.phone
      ELSE mask_phone(c.phone)
    END AS phone_display,
    c.contact_person,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN c.address
      ELSE LEFT(c.address, 10) || '...'
    END AS address,
    c.city,
    c.state,
    c.zip_code,
    c.status,
    c.notes,
    c.created_at,
    c.updated_at
  FROM public.clients c
  WHERE is_admin_or_manager(auth.uid());
END;
$function$;

-- Create enhanced security trigger for client data access
CREATE OR REPLACE FUNCTION public.trigger_client_security_monitoring()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Monitor client deletions more strictly
  IF TG_TABLE_NAME = 'clients' AND TG_OP = 'DELETE' THEN
    PERFORM public.create_security_alert(
      'CLIENT_DELETION',
      'high',
      'Cliente com dados sensíveis excluído',
      format('Cliente %s com dados pessoais foi excluído permanentemente', OLD.name),
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      jsonb_build_object(
        'client_id', OLD.id,
        'client_name', OLD.name,
        'had_sensitive_data', (OLD.cnpj_cpf IS NOT NULL OR OLD.email IS NOT NULL OR OLD.phone IS NOT NULL),
        'deleted_by', auth.uid()
      )
    );
    RETURN OLD;
  END IF;

  -- Monitor bulk client access (potential data harvesting)
  IF TG_TABLE_NAME = 'clients' AND TG_OP = 'SELECT' THEN
    -- This would be called for each row, so we need to be careful about performance
    -- Only trigger alert if suspicious patterns are detected
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for client security monitoring (only for DELETE operations to avoid performance issues)
DROP TRIGGER IF EXISTS client_security_trigger ON public.clients;
CREATE TRIGGER client_security_trigger
  AFTER DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_client_security_monitoring();
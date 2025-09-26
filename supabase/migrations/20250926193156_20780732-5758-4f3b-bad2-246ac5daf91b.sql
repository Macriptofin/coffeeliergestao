-- Create secure user profiles view (corrected)
CREATE OR REPLACE VIEW public.secure_user_profiles AS
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

-- Enhanced security for storage buckets - ensure they are private
UPDATE storage.buckets 
SET public = false 
WHERE public = true;

-- Create storage policy for secure file access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Secure file access for authenticated users'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Secure file access for authenticated users"
    ON storage.objects FOR SELECT
    USING (
      auth.uid() IS NOT NULL AND
      (
        -- Users can access their own files
        auth.uid()::text = (storage.foldername(name))[1] OR
        -- Admins can access all files
        has_role(auth.uid(), 'admin') OR
        -- Managers can access business files
        (has_role(auth.uid(), 'manager') AND bucket_id IN ('reports', 'documents'))
      )
    );
  END IF;
END $$;

-- Policy for file uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Secure file upload for authenticated users'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Secure file upload for authenticated users"
    ON storage.objects FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL AND
      (
        -- Users can upload to their own folder
        auth.uid()::text = (storage.foldername(name))[1] OR
        -- Admins can upload anywhere
        has_role(auth.uid(), 'admin') OR
        -- Managers can upload business files
        (has_role(auth.uid(), 'manager') AND bucket_id IN ('reports', 'documents'))
      )
    );
  END IF;
END $$;

-- Enhanced audit logging trigger for sensitive operations
CREATE OR REPLACE FUNCTION public.enhanced_security_audit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply enhanced audit to sensitive tables
DROP TRIGGER IF EXISTS enhanced_audit_clients ON public.clients;
CREATE TRIGGER enhanced_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enhanced_security_audit();

DROP TRIGGER IF EXISTS enhanced_audit_employees ON public.employees;  
CREATE TRIGGER enhanced_audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.enhanced_security_audit();

-- Function to sanitize error messages
CREATE OR REPLACE FUNCTION public.sanitize_error_message(error_msg text)
RETURNS text AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;
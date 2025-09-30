-- ============================================================================
-- CRITICAL SECURITY ENHANCEMENTS - Fixed Version
-- Phase 1: Database-Level Protection for PII and Authentication
-- ============================================================================

-- 1. RESTRICT AUTH_ATTEMPTS TABLE (Prevent log manipulation)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert auth attempts" ON public.auth_attempts;

CREATE POLICY "Only system can insert auth attempts"
ON public.auth_attempts
FOR INSERT
WITH CHECK (false);

-- Create secure function for logging auth attempts (system use only)
CREATE OR REPLACE FUNCTION public.log_auth_attempt_secure(
  p_email text,
  p_attempt_type text,
  p_success boolean,
  p_failure_reason text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id uuid;
BEGIN
  INSERT INTO public.auth_attempts (
    email, attempt_type, success, failure_reason, ip_address, user_agent
  ) VALUES (
    p_email, p_attempt_type, p_success, p_failure_reason, p_ip_address, p_user_agent
  ) RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$;

-- 2. ENHANCED PII ACCESS TRACKING
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE pii_field_type AS ENUM (
    'email', 'phone', 'cpf', 'cnpj', 'rg', 'address', 
    'salary', 'bank_account', 'pis_pasep', 'ctps'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.pii_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  accessed_table text NOT NULL,
  accessed_record_id uuid NOT NULL,
  accessed_fields pii_field_type[] NOT NULL,
  access_type text NOT NULL,
  ip_address text,
  user_agent text,
  justification text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view PII access logs"
ON public.pii_access_log FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert PII access logs"
ON public.pii_access_log FOR INSERT
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pii_access_log_user_time 
ON public.pii_access_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pii_access_log_table_record 
ON public.pii_access_log(accessed_table, accessed_record_id);

-- 3. FIELD-LEVEL SALARY PROTECTION
-- ============================================================================
ALTER TABLE public.employees DROP COLUMN IF EXISTS salary;

ALTER TABLE public.employee_salary_info 
  DROP CONSTRAINT IF EXISTS employee_salary_info_employee_fkey;

ALTER TABLE public.employee_salary_info 
  ALTER COLUMN employee_id SET NOT NULL,
  ADD CONSTRAINT employee_salary_info_employee_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Only admins can manage salary info" ON public.employee_salary_info;
DROP POLICY IF EXISTS "Only admins can view salary info" ON public.employee_salary_info;

CREATE POLICY "Only admins can view salary info"
ON public.employee_salary_info FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert salary info"
ON public.employee_salary_info FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update salary info"
ON public.employee_salary_info FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete salary info"
ON public.employee_salary_info FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 4. CREATE SECURE PII ACCESS FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_pii_access_secure(
  p_table_name text,
  p_record_id uuid,
  p_fields pii_field_type[],
  p_access_type text,
  p_justification text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_ip_address text;
BEGIN
  BEGIN
    v_ip_address := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
  EXCEPTION
    WHEN OTHERS THEN
      v_ip_address := 'unknown';
  END;
  
  INSERT INTO public.pii_access_log (
    user_id, accessed_table, accessed_record_id, accessed_fields, 
    access_type, ip_address, justification
  ) VALUES (
    auth.uid(), p_table_name, p_record_id, p_fields, 
    p_access_type, v_ip_address, p_justification
  ) RETURNING id INTO v_log_id;
  
  PERFORM detect_pii_anomaly(auth.uid(), p_table_name, 1);
  
  RETURN v_log_id;
END;
$$;

-- 5. TIME-BASED ACCESS RESTRICTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.access_time_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL,
  allowed_start_hour integer NOT NULL DEFAULT 6,
  allowed_end_hour integer NOT NULL DEFAULT 22,
  allowed_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.access_time_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage access time restrictions"
ON public.access_time_restrictions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.access_time_restrictions (operation_type, allowed_start_hour, allowed_end_hour)
VALUES 
  ('salary_view', 6, 22),
  ('bulk_export', 8, 18),
  ('pii_unmask', 6, 22)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_within_allowed_time(p_operation_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restriction record;
  v_current_hour integer;
  v_current_day integer;
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN true;
  END IF;
  
  v_current_hour := EXTRACT(HOUR FROM CURRENT_TIME);
  v_current_day := EXTRACT(ISODOW FROM CURRENT_DATE);
  
  SELECT * INTO v_restriction
  FROM public.access_time_restrictions
  WHERE operation_type = p_operation_type AND is_active = true
  LIMIT 1;
  
  IF v_restriction.id IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN (
    v_current_hour >= v_restriction.allowed_start_hour
    AND v_current_hour < v_restriction.allowed_end_hour
    AND v_current_day = ANY(v_restriction.allowed_days)
  );
END;
$$;

-- 6. ENHANCED SECURITY AUDIT WITH PII TRACKING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enhanced_security_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pii_fields pii_field_type[] := ARRAY[]::pii_field_type[];
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    v_pii_fields := ARRAY['email', 'phone', 'cnpj', 'address']::pii_field_type[];
  ELSIF TG_TABLE_NAME = 'employees' THEN
    v_pii_fields := ARRAY['email', 'phone', 'cpf', 'rg', 'address', 'pis_pasep', 'ctps', 'bank_account']::pii_field_type[];
  ELSIF TG_TABLE_NAME = 'employee_salary_info' THEN
    v_pii_fields := ARRAY['salary']::pii_field_type[];
  END IF;
  
  INSERT INTO public.security_audit_log (
    user_id, action, resource_type, resource_id, details, ip_address
  ) VALUES (
    auth.uid(),
    TG_OP || '_' || upper(TG_TABLE_NAME),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'operation', TG_OP,
      'pii_fields', v_pii_fields,
      'timestamp', now()
    ),
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
  );
  
  IF TG_OP IN ('SELECT', 'UPDATE') AND array_length(v_pii_fields, 1) > 0 THEN
    INSERT INTO public.pii_access_log (
      user_id, accessed_table, accessed_record_id, accessed_fields, access_type, ip_address
    ) VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      v_pii_fields,
      TG_OP,
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. SECURITY SUMMARY FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_security_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized access to security summary';
  END IF;
  
  SELECT jsonb_build_object(
    'pii_access_last_24h', (
      SELECT COUNT(*) FROM public.pii_access_log
      WHERE created_at > now() - interval '24 hours'
    ),
    'security_alerts_active', (
      SELECT COUNT(*) FROM public.security_alerts WHERE status = 'active'
    ),
    'anomalies_last_week', (
      SELECT COUNT(*) FROM public.pii_access_anomalies
      WHERE detected_at > now() - interval '7 days'
    ),
    'locked_accounts', (
      SELECT COUNT(*) FROM public.account_lockouts
      WHERE locked_until > now() AND unlocked_at IS NULL
    ),
    'failed_auth_attempts_today', (
      SELECT COUNT(*) FROM public.auth_attempts
      WHERE success = false AND created_at > CURRENT_DATE
    )
  ) INTO v_summary;
  
  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_auth_attempt_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_pii_access_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_within_allowed_time TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_summary TO authenticated;
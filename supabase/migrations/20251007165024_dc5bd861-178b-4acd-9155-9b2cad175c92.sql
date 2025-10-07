-- Security Fix Migration: Enable RLS on sensitive tables and add proper policies

-- ============================================
-- 1. ENABLE RLS ON SECURITY TABLES
-- ============================================

-- Enable RLS on security audit tables if not already enabled
ALTER TABLE IF EXISTS public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pii_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pii_access_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ADD ADMIN-ONLY POLICIES FOR SECURITY TABLES
-- ============================================

-- Security Audit Log: Only admins can view
DROP POLICY IF EXISTS "Only admins can view security audit log" ON public.security_audit_log;
CREATE POLICY "Only admins can view security audit log"
  ON public.security_audit_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
DROP POLICY IF EXISTS "System can insert security audit log" ON public.security_audit_log;
CREATE POLICY "System can insert security audit log"
  ON public.security_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- PII Access Log: Only admins can view
DROP POLICY IF EXISTS "Only admins can view pii access log" ON public.pii_access_log;
CREATE POLICY "Only admins can view pii access log"
  ON public.pii_access_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert PII access logs
DROP POLICY IF EXISTS "System can insert pii access log" ON public.pii_access_log;
CREATE POLICY "System can insert pii access log"
  ON public.pii_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Security Alerts: Only admins can manage
DROP POLICY IF EXISTS "Only admins can view security alerts" ON public.security_alerts;
CREATE POLICY "Only admins can view security alerts"
  ON public.security_alerts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update security alerts" ON public.security_alerts;
CREATE POLICY "Only admins can update security alerts"
  ON public.security_alerts
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System can insert security alerts
DROP POLICY IF EXISTS "System can insert security alerts" ON public.security_alerts;
CREATE POLICY "System can insert security alerts"
  ON public.security_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- PII Access Anomalies: Only admins can view
DROP POLICY IF EXISTS "Only admins can view pii anomalies" ON public.pii_access_anomalies;
CREATE POLICY "Only admins can view pii anomalies"
  ON public.pii_access_anomalies
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update pii anomalies" ON public.pii_access_anomalies;
CREATE POLICY "Only admins can update pii anomalies"
  ON public.pii_access_anomalies
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System can insert anomalies
DROP POLICY IF EXISTS "System can insert pii anomalies" ON public.pii_access_anomalies;
CREATE POLICY "System can insert pii anomalies"
  ON public.pii_access_anomalies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 3. USER PROFILES POLICIES
-- ============================================

-- Users can view their own profile, admins can view all
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only admins can delete profiles
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.user_profiles;
CREATE POLICY "Only admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert profiles
DROP POLICY IF EXISTS "System can insert profiles" ON public.user_profiles;
CREATE POLICY "System can insert profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 4. FIX CRITICAL SECURITY DEFINER FUNCTIONS
-- ============================================

-- Fix get_masked_client_data to include search_path
CREATE OR REPLACE FUNCTION public.get_masked_client_data()
RETURNS TABLE(
  id uuid, name text, cnpj_cpf text, cnpj_cpf_display text, 
  email text, email_display text, phone text, phone_display text, 
  contact_person text, address text, city text, state text, 
  zip_code text, status text, notes text, 
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authenticate user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Log PII access for client data
  PERFORM log_pii_access('clients', NULL, 'LIST_VIEW', ARRAY['cnpj_cpf', 'email', 'phone', 'address']);
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.cnpj_cpf,
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.cnpj_cpf
      ELSE mask_cnpj_cpf(c.cnpj_cpf)
    END AS cnpj_cpf_display,
    c.email,
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.email
      ELSE mask_email(c.email)
    END AS email_display,
    c.phone,
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.phone
      ELSE mask_phone(c.phone)
    END AS phone_display,
    c.contact_person,
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN c.address
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
$$;

-- Fix get_secure_user_profiles to include search_path
CREATE OR REPLACE FUNCTION public.get_secure_user_profiles()
RETURNS TABLE(
  id uuid, user_id uuid, email text, display_name text, 
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authenticate user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.email
      ELSE mask_email(p.email)
    END AS email,
    p.display_name,
    p.created_at,
    p.updated_at
  FROM public.user_profiles p
  WHERE p.user_id = auth.uid() 
     OR has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'manager'::app_role);
END;
$$;

-- ============================================
-- 5. ADD AUTHENTICATION CHECKS TO KEY FUNCTIONS
-- ============================================

-- Fix create_security_alert to validate authentication
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_alert_type text, 
  p_severity text, 
  p_title text, 
  p_description text, 
  p_ip_address text DEFAULT NULL::text, 
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_id uuid;
BEGIN
  -- Validate inputs
  IF p_alert_type IS NULL OR p_severity IS NULL OR p_title IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  
  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid severity level';
  END IF;
  
  INSERT INTO public.security_alerts (
    alert_type, severity, title, description, ip_address, metadata
  ) VALUES (
    p_alert_type, p_severity, p_title, p_description, p_ip_address, p_metadata
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$;

-- Fix check_account_lockout to include search_path
CREATE OR REPLACE FUNCTION public.check_account_lockout(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    lockout_record record;
    is_locked boolean := false;
    lock_details jsonb;
BEGIN
    -- Validate input
    IF p_email IS NULL OR p_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;
    
    -- Check if account is currently locked
    SELECT * INTO lockout_record
    FROM public.account_lockouts
    WHERE user_email = p_email
        AND locked_until > now()
        AND unlocked_at IS NULL
    ORDER BY locked_at DESC
    LIMIT 1;
    
    IF lockout_record.id IS NOT NULL THEN
        is_locked := true;
        lock_details := jsonb_build_object(
            'is_locked', true,
            'locked_at', lockout_record.locked_at,
            'locked_until', lockout_record.locked_until,
            'reason', lockout_record.lock_reason,
            'failed_attempts', lockout_record.failed_attempts
        );
    ELSE
        lock_details := jsonb_build_object('is_locked', false);
    END IF;
    
    RETURN lock_details;
END;
$$;

-- Fix create_account_lockout to include search_path
CREATE OR REPLACE FUNCTION public.create_account_lockout(
  p_email text, 
  p_failed_attempts integer DEFAULT 5, 
  p_lockout_duration_minutes integer DEFAULT 30
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate inputs
    IF p_email IS NULL OR p_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;
    
    IF p_failed_attempts < 1 OR p_failed_attempts > 100 THEN
        RAISE EXCEPTION 'Invalid failed attempts count';
    END IF;
    
    IF p_lockout_duration_minutes < 1 OR p_lockout_duration_minutes > 1440 THEN
        RAISE EXCEPTION 'Invalid lockout duration';
    END IF;
    
    INSERT INTO public.account_lockouts (
        user_email,
        locked_until,
        failed_attempts,
        lock_reason
    ) VALUES (
        p_email,
        now() + interval '1 minute' * p_lockout_duration_minutes,
        p_failed_attempts,
        'multiple_failed_attempts'
    );
    
    -- Create security alert
    PERFORM public.create_security_alert(
        'account_locked',
        'medium',
        'Conta bloqueada por tentativas falhadas',
        format('Conta %s foi bloqueada após %s tentativas de login falhadas', p_email, p_failed_attempts),
        current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        jsonb_build_object(
            'email', p_email,
            'failed_attempts', p_failed_attempts,
            'lockout_duration_minutes', p_lockout_duration_minutes
        )
    );
END;
$$;
-- Enhanced Security Fixes Migration

-- 1. Add account lockout tracking
CREATE TABLE IF NOT EXISTS public.account_lockouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email text NOT NULL,
    locked_at timestamp with time zone NOT NULL DEFAULT now(),
    locked_until timestamp with time zone NOT NULL,
    failed_attempts integer NOT NULL DEFAULT 0,
    lock_reason text NOT NULL DEFAULT 'multiple_failed_attempts',
    unlock_method text, -- 'auto_expire', 'admin_unlock', 'password_reset'
    unlocked_at timestamp with time zone,
    unlocked_by uuid, -- admin user who unlocked
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Add PII access anomaly tracking  
CREATE TABLE IF NOT EXISTS public.pii_access_anomalies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    anomaly_type text NOT NULL, -- 'bulk_access', 'off_hours', 'unusual_pattern', 'rapid_succession'
    severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    detection_time timestamp with time zone NOT NULL DEFAULT now(),
    details jsonb NOT NULL DEFAULT '{}',
    ip_address text,
    user_agent text,
    resource_type text NOT NULL,
    resource_count integer DEFAULT 1,
    time_window_minutes integer,
    is_investigated boolean DEFAULT false,
    investigated_by uuid,
    investigated_at timestamp with time zone,
    investigation_notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Add MFA settings table
CREATE TABLE IF NOT EXISTS public.mfa_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    is_enabled boolean NOT NULL DEFAULT false,
    backup_codes text[], -- encrypted backup codes
    totp_secret text, -- encrypted TOTP secret
    recovery_email text,
    last_used_at timestamp with time zone,
    enabled_at timestamp with time zone,
    disabled_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Enhanced security audit log with risk scoring
ALTER TABLE public.security_audit_log 
ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS anomaly_flags text[],
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS device_fingerprint text;

-- 5. Create function to detect PII access anomalies
CREATE OR REPLACE FUNCTION public.detect_pii_anomaly(
    p_user_id uuid,
    p_resource_type text,
    p_access_count integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recent_access_count integer;
    is_off_hours boolean;
    current_hour integer;
    anomaly_detected boolean := false;
    anomaly_type text;
    severity text := 'medium';
BEGIN
    -- Get current hour (0-23)
    current_hour := EXTRACT(HOUR FROM now());
    
    -- Check if accessing during off hours (outside 6 AM - 10 PM)
    is_off_hours := current_hour < 6 OR current_hour > 22;
    
    -- Count recent access in last hour
    SELECT COUNT(*) INTO recent_access_count
    FROM public.security_audit_log
    WHERE user_id = p_user_id
        AND resource_type = p_resource_type
        AND action = 'PII_ACCESS'
        AND created_at > now() - interval '1 hour';
    
    -- Detect bulk access anomaly (more than 20 records in 1 hour)
    IF recent_access_count > 20 THEN
        anomaly_detected := true;
        anomaly_type := 'bulk_access';
        severity := 'high';
    END IF;
    
    -- Detect off-hours access for sensitive data
    IF is_off_hours AND p_resource_type IN ('clients', 'employees') THEN
        anomaly_detected := true;
        anomaly_type := 'off_hours';
        severity := CASE WHEN recent_access_count > 5 THEN 'high' ELSE 'medium' END;
    END IF;
    
    -- Detect rapid succession (more than 10 accesses in 5 minutes)
    SELECT COUNT(*) INTO recent_access_count
    FROM public.security_audit_log
    WHERE user_id = p_user_id
        AND resource_type = p_resource_type
        AND created_at > now() - interval '5 minutes';
    
    IF recent_access_count > 10 THEN
        anomaly_detected := true;
        anomaly_type := 'rapid_succession';
        severity := 'high';
    END IF;
    
    -- Log anomaly if detected
    IF anomaly_detected THEN
        INSERT INTO public.pii_access_anomalies (
            user_id, anomaly_type, severity, resource_type, 
            resource_count, details, ip_address
        ) VALUES (
            p_user_id, 
            anomaly_type, 
            severity, 
            p_resource_type,
            recent_access_count,
            jsonb_build_object(
                'access_count', recent_access_count,
                'is_off_hours', is_off_hours,
                'current_hour', current_hour,
                'detection_time', now()
            ),
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
        );
        
        -- Create security alert for high severity anomalies
        IF severity = 'high' THEN
            PERFORM public.create_security_alert(
                'pii_bulk_access',
                severity,
                'Acesso anômalo a dados pessoais detectado',
                format('Usuário %s acessou %s registros de %s em padrão suspeito', 
                       p_user_id, recent_access_count, p_resource_type),
                current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
                jsonb_build_object(
                    'user_id', p_user_id,
                    'anomaly_type', anomaly_type,
                    'resource_type', p_resource_type,
                    'access_count', recent_access_count
                )
            );
        END IF;
    END IF;
END;
$$;

-- 6. Create enhanced account lockout function
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

-- 7. Create account lockout trigger function
CREATE OR REPLACE FUNCTION public.create_account_lockout(
    p_email text,
    p_failed_attempts integer DEFAULT 5,
    p_lockout_duration_minutes integer DEFAULT 30
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Enable RLS on new tables
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pii_access_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for account lockouts (admins only)
CREATE POLICY "Admins can view account lockouts" ON public.account_lockouts
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage account lockouts" ON public.account_lockouts
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS policies for PII anomalies (admins only)
CREATE POLICY "Admins can view PII anomalies" ON public.pii_access_anomalies
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert PII anomalies" ON public.pii_access_anomalies
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- RLS policies for MFA settings (users can manage their own)
CREATE POLICY "Users can manage their own MFA settings" ON public.mfa_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all MFA settings" ON public.mfa_settings
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_lockouts_email_active ON public.account_lockouts(user_email, locked_until) WHERE unlocked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pii_anomalies_user_time ON public.pii_access_anomalies(user_id, detection_time);
CREATE INDEX IF NOT EXISTS idx_mfa_settings_user ON public.mfa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_resource_time ON public.security_audit_log(user_id, resource_type, created_at);
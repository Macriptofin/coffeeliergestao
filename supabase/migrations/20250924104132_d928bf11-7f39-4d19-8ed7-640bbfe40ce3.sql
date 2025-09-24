-- Create rate limiting and security enhancement tables

-- Create authentication attempts tracking table
CREATE TABLE public.auth_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address TEXT,
    attempt_type TEXT NOT NULL CHECK (attempt_type IN ('signin', 'signup', 'password_reset')),
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_agent TEXT,
    failure_reason TEXT
);

-- Add indexes for performance
CREATE INDEX idx_auth_attempts_email_created ON public.auth_attempts(email, created_at);
CREATE INDEX idx_auth_attempts_ip_created ON public.auth_attempts(ip_address, created_at);

-- Enable RLS
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to auth attempts
CREATE POLICY "Admins can view auth attempts" ON public.auth_attempts
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Create policy for inserting attempts (anyone can insert for tracking)
CREATE POLICY "Anyone can insert auth attempts" ON public.auth_attempts
    FOR INSERT WITH CHECK (true);

-- Add financial role for enhanced financial security
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial';

-- Create financial access control table
CREATE TABLE public.financial_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view_all', 'view_department', 'approve_transactions', 'manage_budgets')),
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, permission_type, department)
);

-- Enable RLS on financial permissions
ALTER TABLE public.financial_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for financial permissions
CREATE POLICY "Admins can manage financial permissions" ON public.financial_permissions
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Financial users can view their own permissions" ON public.financial_permissions
    FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Create security alerts table for monitoring
CREATE TABLE public.security_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('multiple_failed_login', 'suspicious_ip', 'role_change', 'financial_access', 'pii_bulk_access')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    user_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and create policies for security alerts
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view security alerts" ON public.security_alerts
    FOR SELECT USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "System can insert security alerts" ON public.security_alerts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can acknowledge alerts" ON public.security_alerts
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Create function to check rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_email text,
    p_ip_address text,
    p_attempt_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    email_attempts_count integer;
    ip_attempts_count integer;
    last_attempt_time timestamp with time zone;
    cooldown_minutes integer := 15;
    max_email_attempts integer := 5;
    max_ip_attempts integer := 10;
BEGIN
    -- Count failed attempts for email in last hour
    SELECT COUNT(*), MAX(created_at)
    INTO email_attempts_count, last_attempt_time
    FROM public.auth_attempts
    WHERE email = p_email 
        AND success = false 
        AND created_at > now() - interval '1 hour';

    -- Count failed attempts for IP in last hour
    SELECT COUNT(*)
    INTO ip_attempts_count
    FROM public.auth_attempts
    WHERE ip_address = p_ip_address 
        AND success = false 
        AND created_at > now() - interval '1 hour';

    -- Check if user is in cooldown period
    IF last_attempt_time IS NOT NULL AND 
       last_attempt_time > (now() - interval '1 minute' * cooldown_minutes) AND
       email_attempts_count >= max_email_attempts THEN
        
        -- Create security alert for repeated attempts
        INSERT INTO public.security_alerts (
            alert_type, severity, title, description, ip_address, metadata
        ) VALUES (
            'multiple_failed_login',
            'high',
            'Múltiplas tentativas de login falhadas',
            format('Email %s teve %s tentativas falhadas do IP %s', p_email, email_attempts_count, p_ip_address),
            p_ip_address,
            jsonb_build_object(
                'email', p_email,
                'attempts', email_attempts_count,
                'last_attempt', last_attempt_time
            )
        );

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'rate_limited',
            'message', format('Muitas tentativas falhadas. Tente novamente em %s minutos.', 
                            EXTRACT(EPOCH FROM (last_attempt_time + interval '1 minute' * cooldown_minutes - now()))/60),
            'retry_after', last_attempt_time + interval '1 minute' * cooldown_minutes
        );
    END IF;

    -- Check email rate limit
    IF email_attempts_count >= max_email_attempts THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'email_rate_limited',
            'message', format('Muitas tentativas para este email. Tente novamente em 1 hora.'),
            'retry_after', now() + interval '1 hour'
        );
    END IF;

    -- Check IP rate limit
    IF ip_attempts_count >= max_ip_attempts THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'ip_rate_limited',
            'message', 'Muitas tentativas deste IP. Tente novamente em 1 hora.',
            'retry_after', now() + interval '1 hour'
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Create function to log authentication attempts
CREATE OR REPLACE FUNCTION public.log_auth_attempt(
    p_email text,
    p_ip_address text,
    p_attempt_type text,
    p_success boolean,
    p_user_agent text DEFAULT NULL,
    p_failure_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.auth_attempts (
        email, ip_address, attempt_type, success, user_agent, failure_reason
    ) VALUES (
        p_email, p_ip_address, p_attempt_type, p_success, p_user_agent, p_failure_reason
    );
END;
$$;

-- Create function to check financial permissions
CREATE OR REPLACE FUNCTION public.has_financial_permission(
    p_user_id uuid,
    p_permission_type text,
    p_department text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Admins have all financial permissions
    IF has_role(p_user_id, 'admin') THEN
        RETURN true;
    END IF;

    -- Check specific financial role permissions
    IF has_role(p_user_id, 'financial') THEN
        -- Financial role users need specific permissions
        RETURN EXISTS (
            SELECT 1 FROM public.financial_permissions
            WHERE user_id = p_user_id 
                AND permission_type = p_permission_type
                AND (p_department IS NULL OR department = p_department OR department IS NULL)
        );
    END IF;

    RETURN false;
END;
$$;
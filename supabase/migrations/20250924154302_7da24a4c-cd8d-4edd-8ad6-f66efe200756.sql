-- Criar função para criar alertas de segurança automáticos
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_alert_type text,
  p_severity text,
  p_title text,
  p_description text,
  p_ip_address text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  alert_id uuid;
BEGIN
  INSERT INTO public.security_alerts (
    alert_type, severity, title, description, ip_address, metadata
  ) VALUES (
    p_alert_type, p_severity, p_title, p_description, p_ip_address, p_metadata
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$;
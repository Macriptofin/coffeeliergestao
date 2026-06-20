-- Configurações públicas do portal (somente contato) — expostas com segurança.
INSERT INTO public.app_settings (key, value)
VALUES ('portal.whatsapp', ''), ('portal.contact_email', '')
ON CONFLICT (key) DO NOTHING;

-- RPC que devolve apenas as configs de contato do portal (sem vazar pricing/etc).
CREATE OR REPLACE FUNCTION public.get_portal_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'whatsapp',      (SELECT value FROM public.app_settings WHERE key = 'portal.whatsapp'),
    'contact_email', (SELECT value FROM public.app_settings WHERE key = 'portal.contact_email')
  );
$$;

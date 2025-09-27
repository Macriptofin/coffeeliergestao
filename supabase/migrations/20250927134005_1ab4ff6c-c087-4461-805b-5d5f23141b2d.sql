-- Ativar feature flag para unificar BOM e Receitas
INSERT INTO public.app_settings (key, value) VALUES ('FF_UNIFY_BOM_RECEITAS', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
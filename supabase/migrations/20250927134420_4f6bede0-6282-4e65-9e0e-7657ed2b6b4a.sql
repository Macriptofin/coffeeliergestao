-- Ativar todos os feature flags para a unificação completa
INSERT INTO public.app_settings (key, value) VALUES 
  ('FF_MOVE_COSTS_TO_REPORTS', 'true'),
  ('FF_ORDERS_AS_CENTRAL', 'true'),
  ('FF_EVENT_TABLES_ENABLED', 'true')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();
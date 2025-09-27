-- Create app_settings table for feature flags (idempotent)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for app_settings
CREATE POLICY "Anyone authenticated can read app_settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage app_settings" 
ON public.app_settings 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Create function to get flag value (idempotent)
CREATE OR REPLACE FUNCTION public.get_flag(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::boolean FROM public.app_settings WHERE key = p_key),
    false
  );
$$;

-- Upsert feature flags (idempotent)
INSERT INTO public.app_settings (key, value) VALUES 
  ('FF_UNIFY_BOM_RECEITAS', 'true'),
  ('FF_MOVE_COSTS_TO_REPORTS', 'true'), 
  ('FF_ORDERS_AS_CENTRAL', 'true'),
  ('FF_EVENT_TABLES_ENABLED', 'true')
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
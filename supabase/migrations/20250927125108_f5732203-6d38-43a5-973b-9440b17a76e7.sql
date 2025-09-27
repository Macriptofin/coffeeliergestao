-- Aplicando RLS e políticas de segurança para as novas tabelas

-- Consumption Profiles
ALTER TABLE public.consumption_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view consumption_profiles" 
ON public.consumption_profiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage consumption_profiles" 
ON public.consumption_profiles FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Consumption Profile Mix
ALTER TABLE public.consumption_profile_mix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view consumption_profile_mix" 
ON public.consumption_profile_mix FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage consumption_profile_mix" 
ON public.consumption_profile_mix FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Table Templates
ALTER TABLE public.event_table_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view event_table_templates" 
ON public.event_table_templates FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage event_table_templates" 
ON public.event_table_templates FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Table Template Items
ALTER TABLE public.event_table_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view event_table_template_items" 
ON public.event_table_template_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage event_table_template_items" 
ON public.event_table_template_items FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Tables
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and managers can manage event_tables" 
ON public.event_tables FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Table Items
ALTER TABLE public.event_table_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and managers can manage event_table_items" 
ON public.event_table_items FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Production Orders
ALTER TABLE public.event_production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and managers can manage event_production_orders" 
ON public.event_production_orders FOR ALL 
USING (is_admin_or_manager(auth.uid()));

-- Event Production Order Items
ALTER TABLE public.event_production_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins and managers can manage event_production_order_items" 
ON public.event_production_order_items FOR ALL 
USING (is_admin_or_manager(auth.uid()));
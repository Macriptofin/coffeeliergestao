-- Catálogo curado por cliente: a equipe define quais produtos cada cliente pode pedir no portal.
CREATE TABLE IF NOT EXISTS public.client_catalog_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  UNIQUE (client_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_client_catalog_client ON public.client_catalog_items(client_id);
ALTER TABLE public.client_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccat_internal ON public.client_catalog_items
  FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY ccat_portal_read ON public.client_catalog_items
  FOR SELECT TO authenticated
  USING (client_id = public.current_portal_client_id() AND is_active);

CREATE OR REPLACE FUNCTION public.get_portal_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'material_id', m.id, 'name', m.name, 'category', m.category, 'subcategory', m.subcategory,
    'unit', m.usage_unit, 'unit_weight', m.unit_weight,
    'price', COALESCE(m.practiced_price, m.suggested_price, 0)
  ) ORDER BY m.category, m.name), '[]'::jsonb)
  FROM public.client_catalog_items cci
  JOIN public.materials m ON m.id = cci.material_id
  WHERE cci.client_id = public.current_portal_client_id()
    AND cci.is_active AND m.is_archived = false AND m.is_sellable = true;
$$;

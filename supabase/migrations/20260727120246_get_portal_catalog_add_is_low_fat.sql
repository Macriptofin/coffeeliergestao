-- Adiciona is_low_fat ao catálogo do portal, pra permitir a seção "Light" no
-- combobox de montar pedido, espelhando a seção Low Fat do editor interno
-- (tag REST_LOWFAT), sem expor toda a árvore de tags.
CREATE OR REPLACE FUNCTION public.get_portal_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'material_id', m.id,
    'name', m.name,
    'category', m.category,
    'subcategory', m.subcategory,
    'unit', m.usage_unit,
    'unit_weight', m.unit_weight,
    'price', COALESCE(m.practiced_price, m.suggested_price, 0),
    'is_low_fat', EXISTS (
      SELECT 1 FROM public.material_tags mt
      JOIN public.taxonomy_terms tt ON tt.id = mt.term_id
      WHERE mt.material_id = m.id AND tt.code = 'REST_LOWFAT'
    )
  ) ORDER BY m.category, m.name), '[]'::jsonb)
  FROM public.materials m
  WHERE public.current_portal_client_id() IS NOT NULL
    AND m.is_archived = false
    AND m.is_sellable = true
    AND m.is_portal_visible = true;
$function$;

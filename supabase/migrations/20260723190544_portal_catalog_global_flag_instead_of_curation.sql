-- Decisão de produto: o catálogo do Portal (self-service) deixa de ser curado
-- item-a-item por cliente (client_catalog_items, inviável em escala — pensando
-- em milhares de clientes) e passa a ser um flag GLOBAL no produto: "disponível
-- no Portal ou não", igual já existe is_sellable para "vendável ou não".
-- Default true: todo produto vendável já aparece no Portal, exceção é quem
-- desliga (não o contrário).
ALTER TABLE public.materials ADD COLUMN is_portal_visible boolean NOT NULL DEFAULT true;

-- get_portal_catalog passa a filtrar por esse flag global em vez de junção
-- com client_catalog_items (curadoria por cliente, aposentada).
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
    'price', COALESCE(m.practiced_price, m.suggested_price, 0)
  ) ORDER BY m.category, m.name), '[]'::jsonb)
  FROM public.materials m
  WHERE public.current_portal_client_id() IS NOT NULL  -- exige sessão de portal válida
    AND m.is_archived = false
    AND m.is_sellable = true
    AND m.is_portal_visible = true;
$function$;

-- client_catalog_items tinha só 2 linhas de teste (1 cliente) — nunca foi
-- populada de verdade. Curadoria por cliente aposentada, tabela removida
-- (não é dado de negócio histórico, é config de feature substituída).
DROP TABLE IF EXISTS public.client_catalog_items;

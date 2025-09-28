-- Fix security issues: remove SECURITY DEFINER from views and set proper search_path

-- Drop existing views that have SECURITY DEFINER
DROP VIEW IF EXISTS public.vw_diag_material_dupes;
DROP VIEW IF EXISTS public.vw_diag_bom_inconsistencies;
DROP VIEW IF EXISTS public.vw_diag_orphans;

-- Recreate views without SECURITY DEFINER (they will use invoker's permissions)
CREATE VIEW public.vw_diag_material_dupes AS
WITH material_groups AS (
  SELECT 
    LOWER(TRIM(name)) as candidate_key,
    array_agg(id ORDER BY created_at) as material_ids,
    array_agg(name ORDER BY created_at) as names,
    array_agg(EXISTS(SELECT 1 FROM stock_items WHERE material_id = materials.id)) as has_stock_flags,
    array_agg(EXISTS(SELECT 1 FROM recipe_bom_items WHERE material_id = materials.id) 
             OR EXISTS(SELECT 1 FROM composite_bom_items WHERE component_material_id = materials.id)
             OR EXISTS(SELECT 1 FROM recipes_bom WHERE finished_material_id = materials.id)
             OR EXISTS(SELECT 1 FROM composites_bom WHERE composite_material_id = materials.id)) as has_references_flags,
    COUNT(*) as duplicate_count
  FROM materials
  GROUP BY LOWER(TRIM(name))
  HAVING COUNT(*) > 1
)
SELECT * FROM material_groups;

CREATE VIEW public.vw_diag_bom_inconsistencies AS
SELECT 
  m.id as material_id,
  m.name as material_name,
  m.material_type,
  'Multiple BOMs for single material' as issue_type,
  COUNT(rb.id) as bom_count
FROM materials m
JOIN recipes_bom rb ON rb.finished_material_id = m.id
WHERE m.material_type = 'finished_product'
GROUP BY m.id, m.name, m.material_type
HAVING COUNT(rb.id) > 1

UNION ALL

SELECT 
  m.id as material_id,
  m.name as material_name,
  m.material_type,
  'Missing BOM for finished product' as issue_type,
  0 as bom_count
FROM materials m
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id
WHERE m.material_type = 'finished_product' AND rb.id IS NULL;

CREATE VIEW public.vw_diag_orphans AS
SELECT 
  m.id as material_id,
  m.name as material_name,
  m.material_type,
  m.category,
  m.created_at
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
LEFT JOIN recipe_bom_items rbi ON rbi.material_id = m.id
LEFT JOIN composite_bom_items cbi ON cbi.component_material_id = m.id
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id
LEFT JOIN composites_bom cb ON cb.composite_material_id = m.id
WHERE si.id IS NULL 
  AND rbi.id IS NULL 
  AND cbi.id IS NULL 
  AND rb.id IS NULL 
  AND cb.id IS NULL
  AND m.is_system_generated = true;

-- Fix search_path for function (was missing proper SET)
CREATE OR REPLACE FUNCTION public.validate_material_category() 
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow all categories that exist in taxonomy
  IF NEW.category IS NOT NULL AND NEW.category NOT IN (
    'Insumo', 'Embalagem', 'Produto Intermediário', 'Produto Acabado',
    'Produto Composto', 'Produto de Revenda', 'Higiene e Limpeza',
    'Equipamentos', 'Utensílios', 'Têxteis & Apoios', 'Infraestrutura & Eventos'
  ) THEN
    RAISE EXCEPTION 'Categoria % não é permitida', NEW.category;
  END IF;
  
  RETURN NEW;
END;
$$;
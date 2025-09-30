-- Fix security definer views (corrected syntax)

-- Drop problematic views
DROP VIEW IF EXISTS public.vw_diag_material_dupes CASCADE;
DROP VIEW IF EXISTS public.vw_diag_bom_inconsistencies CASCADE;
DROP VIEW IF EXISTS public.vw_diag_orphans CASCADE;

-- Recreate vw_diag_material_dupes WITHOUT security definer
CREATE VIEW public.vw_diag_material_dupes AS
SELECT 
  LOWER(TRIM(name)) as candidate_key,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at) as material_ids,
  ARRAY_AGG(category ORDER BY created_at) as categories,
  ARRAY_AGG(
    EXISTS(SELECT 1 FROM stock_items si WHERE si.material_id = materials.id)
    ORDER BY created_at
  ) as has_stock_flags,
  ARRAY_AGG(
    EXISTS(
      SELECT 1 FROM recipe_bom_items rbi WHERE rbi.material_id = materials.id
      UNION
      SELECT 1 FROM recipes_bom rb WHERE rb.finished_material_id = materials.id
    )
    ORDER BY created_at
  ) as has_references_flags
FROM materials
WHERE is_archived = false
GROUP BY candidate_key
HAVING COUNT(*) > 1;

-- Recreate vw_diag_bom_inconsistencies WITHOUT security definer (fixed window function)
CREATE VIEW public.vw_diag_bom_inconsistencies AS
WITH bom_counts AS (
  SELECT 
    finished_material_id,
    COUNT(*) as bom_count
  FROM recipes_bom
  GROUP BY finished_material_id
)
SELECT 
  rb.id as bom_id,
  rb.finished_material_id,
  m.name as finished_material_name,
  bc.bom_count as bom_count_for_material,
  COUNT(rbi.id) as item_count,
  COALESCE(
    SUM(
      CASE 
        WHEN rbi.material_id IS NOT NULL 
        THEN (rbi.quantity * COALESCE(mi.price_per_purchase_unit, 0))
        ELSE 0
      END
    ), 0
  ) as estimated_cost
FROM recipes_bom rb
JOIN materials m ON m.id = rb.finished_material_id
LEFT JOIN bom_counts bc ON bc.finished_material_id = rb.finished_material_id
LEFT JOIN recipe_bom_items rbi ON rbi.recipe_id = rb.id
LEFT JOIN materials mi ON mi.id = rbi.material_id
GROUP BY rb.id, rb.finished_material_id, m.name, bc.bom_count;

-- Recreate vw_diag_orphans WITHOUT security definer
CREATE VIEW public.vw_diag_orphans AS
SELECT 
  m.id,
  m.name,
  m.category,
  m.material_type,
  'no_stock' as orphan_type
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE si.id IS NULL
  AND m.is_archived = false
  AND m.material_type = 'ingredient'
UNION ALL
SELECT 
  m.id,
  m.name,
  m.category,
  m.material_type,
  'no_bom' as orphan_type
FROM materials m
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id
WHERE rb.id IS NULL
  AND m.is_archived = false
  AND m.material_type IN ('finished_product', 'intermediate_product');
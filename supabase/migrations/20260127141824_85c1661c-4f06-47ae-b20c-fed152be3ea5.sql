-- Fix remaining Security Definer View: vw_diag_orphans
DROP VIEW IF EXISTS vw_diag_orphans;
CREATE VIEW vw_diag_orphans 
WITH (security_invoker = on) AS
SELECT m.id, m.name, m.category, m.material_type, 'no_stock'::text AS orphan_type
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE si.id IS NULL AND m.is_archived = false AND m.material_type = 'ingredient'::text
UNION ALL
SELECT m.id, m.name, m.category, m.material_type, 'no_bom'::text AS orphan_type
FROM materials m
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id
WHERE rb.id IS NULL AND m.is_archived = false AND m.material_type IN ('finished_product', 'intermediate_product');
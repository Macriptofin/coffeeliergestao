-- =====================================================
-- FIX: Security Definer Views - Convert to SECURITY INVOKER
-- =====================================================

-- 1. Drop and recreate vw_bom_cost_history_detailed with security_invoker
DROP VIEW IF EXISTS vw_bom_cost_history_detailed;
CREATE VIEW vw_bom_cost_history_detailed 
WITH (security_invoker = on) AS
SELECT 
    bch.id,
    bch.bom_type,
    bch.bom_id,
    CASE
        WHEN bch.bom_type = 'recipe'::text THEN (
            SELECT m.name
            FROM recipes_bom rb
            JOIN materials m ON m.id = rb.finished_material_id
            WHERE rb.id = bch.bom_id
        )
        WHEN bch.bom_type = 'composite'::text THEN (
            SELECT m.name
            FROM composites_bom cb
            JOIN materials m ON m.id = cb.composite_material_id
            WHERE cb.id = bch.bom_id
        )
        ELSE NULL::text
    END AS bom_name,
    bch.old_total_cost,
    bch.new_total_cost,
    bch.cost_change_percent,
    bch.cost_change_absolute,
    bch.triggered_by_material_id,
    (SELECT materials.name FROM materials WHERE materials.id = bch.triggered_by_material_id) AS triggered_by_material_name,
    bch.change_reason,
    bch.created_at,
    bch.created_by
FROM bom_cost_history bch
ORDER BY bch.created_at DESC;

-- 2. Drop and recreate vw_cost_audit with security_invoker
DROP VIEW IF EXISTS vw_cost_audit;
CREATE VIEW vw_cost_audit 
WITH (security_invoker = on) AS
SELECT 
    m.id AS material_id,
    m.code AS material_code,
    m.name AS material_name,
    m.category,
    m.subcategory,
    si.average_price,
    si.cost_source,
    si.cost_last_updated_at,
    get_user_email_safe(si.cost_last_updated_by) AS cost_last_updated_by_email,
    si.manual_price,
    m.ncm,
    m.cfop_padrao,
    m.cst_csosn,
    m.origem,
    (SELECT sm.created_at FROM stock_movements sm WHERE sm.material_id = m.id ORDER BY sm.created_at DESC LIMIT 1) AS last_movement_at,
    (SELECT sm.movement_type FROM stock_movements sm WHERE sm.material_id = m.id ORDER BY sm.created_at DESC LIMIT 1) AS last_movement_type,
    si.current_quantity,
    si.total_value,
    m.created_at AS material_created_at,
    m.updated_at AS material_updated_at
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE m.is_archived = false
ORDER BY m.name;

-- 3. Drop and recreate vw_diag_bom_inconsistencies with security_invoker
DROP VIEW IF EXISTS vw_diag_bom_inconsistencies;
CREATE VIEW vw_diag_bom_inconsistencies 
WITH (security_invoker = on) AS
WITH bom_counts AS (
    SELECT 
        recipes_bom.finished_material_id,
        count(*) AS bom_count
    FROM recipes_bom
    GROUP BY recipes_bom.finished_material_id
)
SELECT 
    rb.id AS bom_id,
    rb.finished_material_id,
    m.name AS finished_material_name,
    bc.bom_count AS bom_count_for_material,
    count(rbi.id) AS item_count,
    COALESCE(sum(
        CASE
            WHEN rbi.material_id IS NOT NULL THEN rbi.quantity * COALESCE(mi.price_per_purchase_unit, 0::numeric)
            ELSE 0::numeric
        END
    ), 0::numeric) AS estimated_cost
FROM recipes_bom rb
JOIN materials m ON m.id = rb.finished_material_id
LEFT JOIN bom_counts bc ON bc.finished_material_id = rb.finished_material_id
LEFT JOIN recipe_bom_items rbi ON rbi.recipe_id = rb.id
LEFT JOIN materials mi ON mi.id = rbi.material_id
GROUP BY rb.id, rb.finished_material_id, m.name, bc.bom_count;

-- 4. Drop and recreate vw_diag_material_dupes with security_invoker
DROP VIEW IF EXISTS vw_diag_material_dupes;
CREATE VIEW vw_diag_material_dupes 
WITH (security_invoker = on) AS
SELECT 
    lower(TRIM(BOTH FROM name)) AS candidate_key,
    count(*) AS duplicate_count,
    array_agg(id ORDER BY created_at) AS material_ids,
    array_agg(category ORDER BY created_at) AS categories,
    array_agg((EXISTS (SELECT 1 FROM stock_items si WHERE si.material_id = materials.id)) ORDER BY created_at) AS has_stock_flags,
    array_agg((EXISTS (
        SELECT 1 FROM recipe_bom_items rbi WHERE rbi.material_id = materials.id
        UNION
        SELECT 1 FROM recipes_bom rb WHERE rb.finished_material_id = materials.id
    )) ORDER BY created_at) AS has_references_flags
FROM materials
WHERE is_archived = false
GROUP BY lower(TRIM(BOTH FROM name))
HAVING count(*) > 1;

-- 5. Drop and recreate vw_diag_orphan_materials with security_invoker
DROP VIEW IF EXISTS vw_diag_orphan_materials;
CREATE VIEW vw_diag_orphan_materials 
WITH (security_invoker = on) AS
SELECT m.id, m.name, m.category, m.material_type, 'no_stock'::text AS orphan_type
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE si.id IS NULL AND m.is_archived = false AND m.material_type = 'ingredient'::text
UNION ALL
SELECT m.id, m.name, m.category, m.material_type, 'no_bom'::text AS orphan_type
FROM materials m
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id
WHERE rb.id IS NULL AND m.is_archived = false AND m.material_type = 'recipe'::text;

-- 6. Drop and recreate vw_proposal_breakdown with security_invoker (correct structure)
DROP VIEW IF EXISTS vw_proposal_breakdown;
CREATE VIEW vw_proposal_breakdown 
WITH (security_invoker = on) AS
SELECT 
    pc.proposal_id,
    pci.id AS proposal_item_id,
    pc.id AS category_id,
    pc.category_label,
    pci.item_kind,
    m.id AS material_id,
    m.name AS material_name,
    m.code AS material_code,
    m.material_type,
    COALESCE(pci.fixed_qty, (pci.qty_per_person * (p.number_of_people)::numeric)) AS planned_qty,
    COALESCE(pci.unit_override, m.usage_unit) AS planned_unit,
    m.price_per_purchase_unit AS unit_cost,
    (COALESCE(pci.fixed_qty, (pci.qty_per_person * (p.number_of_people)::numeric)) * m.price_per_purchase_unit) AS total_cost
FROM proposal_category_items pci
JOIN proposal_categories pc ON pc.id = pci.category_id
JOIN proposals p ON p.id = pc.proposal_id
JOIN materials m ON m.id = pci.material_id
WHERE p.status NOT IN ('Cancelada', 'Rejeitada');

-- 7. Drop and recreate vw_stock_below_min with security_invoker (correct structure)
DROP VIEW IF EXISTS vw_stock_below_min;
CREATE VIEW vw_stock_below_min 
WITH (security_invoker = on) AS
SELECT 
    m.id AS material_id,
    m.code,
    m.name,
    m.category,
    m.subcategory,
    m.material_type,
    s.current_quantity,
    s.minimum_quantity,
    (s.minimum_quantity - s.current_quantity) AS deficit_quantity,
    s.average_price,
    ((s.minimum_quantity - s.current_quantity) * COALESCE(s.average_price, 0::numeric)) AS estimated_cost
FROM materials m
JOIN stock_items s ON s.material_id = m.id
WHERE s.current_quantity < s.minimum_quantity AND m.is_archived = false
ORDER BY (s.minimum_quantity - s.current_quantity) DESC;

-- 8. Drop and recreate vw_stock_no_avg_price with security_invoker (correct structure)
DROP VIEW IF EXISTS vw_stock_no_avg_price;
CREATE VIEW vw_stock_no_avg_price 
WITH (security_invoker = on) AS
SELECT 
    m.id AS material_id,
    m.code,
    m.name,
    m.category,
    m.subcategory,
    m.material_type,
    s.current_quantity,
    m.price_per_purchase_unit,
    s.total_value
FROM materials m
JOIN stock_items s ON s.material_id = m.id
WHERE COALESCE(s.average_price, 0::numeric) = 0::numeric 
  AND s.current_quantity > 0::numeric 
  AND m.is_archived = false;

-- 9. Drop and recreate vw_stock_zero with security_invoker (correct structure)
DROP VIEW IF EXISTS vw_stock_zero;
CREATE VIEW vw_stock_zero 
WITH (security_invoker = on) AS
SELECT 
    m.id AS material_id,
    m.code,
    m.name,
    m.category,
    m.subcategory,
    m.material_type,
    COALESCE(s.current_quantity, 0::numeric) AS current_quantity,
    s.average_price,
    CASE WHEN s.material_id IS NULL THEN false ELSE true END AS has_stock_record
FROM materials m
LEFT JOIN stock_items s ON s.material_id = m.id
WHERE COALESCE(s.current_quantity, 0::numeric) = 0::numeric 
  AND m.is_archived = false;
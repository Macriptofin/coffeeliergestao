-- =====================================================================
-- BOM Migration Diagnostic, Cleanup and Finalization System
-- =====================================================================

-- [Doc] Audit log table for all BOM operations
CREATE TABLE IF NOT EXISTS public.ops_bom_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  action TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- [Doc] Add intermediate_product to material_type if not exists
DO $$
BEGIN
  -- Check if intermediate_product type exists in materials table
  IF NOT EXISTS (
    SELECT 1 FROM materials WHERE material_type = 'intermediate_product'
  ) THEN
    -- Add the constraint to allow intermediate_product
    ALTER TABLE public.materials 
    DROP CONSTRAINT IF EXISTS materials_material_type_check;
    
    ALTER TABLE public.materials 
    ADD CONSTRAINT materials_material_type_check 
    CHECK (material_type IN ('ingredient', 'packaging', 'finished_product', 'composite_product', 'resale_product', 'intermediate_product'));
  END IF;
END $$;

-- [Doc] Add is_archived column to materials if not exists
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- [Doc] Add is_system_generated column for migration tracking
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT false;

-- =====================================================================
-- DIAGNOSTIC VIEWS
-- =====================================================================

-- [Doc] View to identify material duplicates
CREATE OR REPLACE VIEW public.vw_diag_material_dupes AS
WITH material_groups AS (
  SELECT 
    LOWER(name) as name_lower,
    category,
    purchase_unit,
    usage_unit,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at DESC) as material_ids,
    ARRAY_AGG(code ORDER BY created_at DESC) as codes,
    ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
  FROM public.materials
  WHERE is_archived = false
  GROUP BY LOWER(name), category, purchase_unit, usage_unit
  HAVING COUNT(*) > 1
),
material_references AS (
  SELECT 
    m.id,
    CASE WHEN si.material_id IS NOT NULL THEN true ELSE false END as has_stock,
    CASE WHEN (
      EXISTS(SELECT 1 FROM recipe_bom_items rbi WHERE rbi.material_id = m.id) OR
      EXISTS(SELECT 1 FROM composite_bom_items cbi WHERE cbi.component_material_id = m.id) OR
      EXISTS(SELECT 1 FROM event_table_items eti WHERE eti.material_id = m.id) OR
      EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.material_id = m.id) OR
      EXISTS(SELECT 1 FROM supplier_products sp WHERE sp.material_id = m.id) OR
      EXISTS(SELECT 1 FROM stock_movements sm WHERE sm.material_id = m.id)
    ) THEN true ELSE false END as has_references
  FROM public.materials m
  LEFT JOIN public.stock_items si ON si.material_id = m.id
)
SELECT 
  mg.name_lower || '|' || mg.category || '|' || mg.purchase_unit || '|' || mg.usage_unit as candidate_key,
  mg.duplicate_count,
  mg.material_ids,
  mg.codes,
  mg.created_dates,
  ARRAY_AGG(mr.has_stock) as has_stock_flags,
  ARRAY_AGG(mr.has_references) as has_references_flags
FROM material_groups mg
JOIN material_references mr ON mr.id = ANY(mg.material_ids)
GROUP BY mg.name_lower, mg.category, mg.purchase_unit, mg.usage_unit, 
         mg.duplicate_count, mg.material_ids, mg.codes, mg.created_dates;

-- [Doc] View to identify BOM inconsistencies
CREATE OR REPLACE VIEW public.vw_diag_bom_inconsistencies AS
WITH empty_boms AS (
  SELECT 
    rb.id,
    rb.finished_material_id,
    m.name as material_name,
    'empty_bom' as issue_type,
    'BOM without items' as description
  FROM public.recipes_bom rb
  LEFT JOIN public.recipe_bom_items rbi ON rbi.recipe_id = rb.id
  LEFT JOIN public.materials m ON m.id = rb.finished_material_id
  WHERE rbi.id IS NULL
),
invalid_references AS (
  SELECT 
    rb.id,
    rb.finished_material_id,
    'invalid_reference' as issue_type,
    'finished_material_id does not exist or wrong type' as description,
    NULL::text as material_name
  FROM public.recipes_bom rb
  LEFT JOIN public.materials m ON m.id = rb.finished_material_id
  WHERE m.id IS NULL OR m.material_type NOT IN ('finished_product', 'intermediate_product')
),
duplicate_boms AS (
  SELECT 
    rb.id,
    rb.finished_material_id,
    m.name as material_name,
    'duplicate_bom' as issue_type,
    'Multiple BOMs for same material' as description
  FROM public.recipes_bom rb
  JOIN public.materials m ON m.id = rb.finished_material_id
  WHERE rb.finished_material_id IN (
    SELECT finished_material_id 
    FROM public.recipes_bom 
    GROUP BY finished_material_id 
    HAVING COUNT(*) > 1
  )
)
SELECT * FROM empty_boms
UNION ALL
SELECT * FROM invalid_references
UNION ALL
SELECT * FROM duplicate_boms;

-- [Doc] View to identify orphaned materials
CREATE OR REPLACE VIEW public.vw_diag_orphans AS
SELECT 
  m.id,
  m.name,
  m.category,
  m.material_type,
  m.created_at,
  'orphan' as status,
  'Material without any references' as description
FROM public.materials m
LEFT JOIN public.stock_items si ON si.material_id = m.id
WHERE m.is_archived = false
  AND (si.current_quantity IS NULL OR si.current_quantity = 0)
  AND NOT EXISTS(SELECT 1 FROM recipe_bom_items rbi WHERE rbi.material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM composite_bom_items cbi WHERE cbi.component_material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM event_table_items eti WHERE eti.material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM supplier_products sp WHERE sp.material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM stock_movements sm WHERE sm.material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM recipes_bom rb WHERE rb.finished_material_id = m.id)
  AND NOT EXISTS(SELECT 1 FROM composites_bom cb WHERE cb.composite_material_id = m.id);

-- =====================================================================
-- UTILITY FUNCTIONS
-- =====================================================================

-- [Doc] Function to check if material can be hard deleted
CREATE OR REPLACE FUNCTION public.can_hard_delete_material(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_stock BOOLEAN := false;
  has_references BOOLEAN := false;
BEGIN
  -- Check stock
  SELECT CASE WHEN si.current_quantity > 0 THEN true ELSE false END
  INTO has_stock
  FROM public.stock_items si
  WHERE si.material_id = p_id;
  
  -- Check references
  SELECT CASE WHEN (
    EXISTS(SELECT 1 FROM recipe_bom_items rbi WHERE rbi.material_id = p_id) OR
    EXISTS(SELECT 1 FROM composite_bom_items cbi WHERE cbi.component_material_id = p_id) OR
    EXISTS(SELECT 1 FROM event_table_items eti WHERE eti.material_id = p_id) OR
    EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.material_id = p_id) OR
    EXISTS(SELECT 1 FROM supplier_products sp WHERE sp.material_id = p_id) OR
    EXISTS(SELECT 1 FROM stock_movements sm WHERE sm.material_id = p_id) OR
    EXISTS(SELECT 1 FROM recipes_bom rb WHERE rb.finished_material_id = p_id) OR
    EXISTS(SELECT 1 FROM composites_bom cb WHERE cb.composite_material_id = p_id)
  ) THEN true ELSE false END
  INTO has_references;
  
  RETURN NOT (has_stock OR has_references);
END;
$$;

-- [Doc] Function to archive material
CREATE OR REPLACE FUNCTION public.archive_material(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.materials
  SET 
    is_archived = true,
    is_sellable = false,
    updated_at = now()
  WHERE id = p_id;
  
  INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
  VALUES (
    'ARCHIVE_MATERIAL',
    jsonb_build_object('material_id', p_id),
    auth.uid()
  );
END;
$$;

-- [Doc] Function to merge materials safely
CREATE OR REPLACE FUNCTION public.merge_materials(
  src UUID, 
  dst UUID, 
  dry_run BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_material RECORD;
  dst_material RECORD;
  src_stock RECORD;
  dst_stock RECORD;
  merge_result JSONB := '{}';
  new_avg_price NUMERIC;
  new_total_qty NUMERIC;
  new_total_value NUMERIC;
BEGIN
  -- Get source and destination materials
  SELECT * INTO src_material FROM public.materials WHERE id = src;
  SELECT * INTO dst_material FROM public.materials WHERE id = dst;
  
  IF src_material.id IS NULL OR dst_material.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Source or destination material not found');
  END IF;
  
  -- Get stock info
  SELECT * INTO src_stock FROM public.stock_items WHERE material_id = src;
  SELECT * INTO dst_stock FROM public.stock_items WHERE material_id = dst;
  
  -- Calculate new weighted average price
  IF src_stock.material_id IS NOT NULL AND dst_stock.material_id IS NOT NULL THEN
    new_total_qty := COALESCE(src_stock.current_quantity, 0) + COALESCE(dst_stock.current_quantity, 0);
    new_total_value := COALESCE(src_stock.total_value, 0) + COALESCE(dst_stock.total_value, 0);
    
    IF new_total_qty > 0 THEN
      new_avg_price := new_total_value / new_total_qty;
    ELSE
      new_avg_price := COALESCE(dst_stock.average_price, src_stock.average_price, 0);
    END IF;
  ELSIF dst_stock.material_id IS NOT NULL THEN
    new_total_qty := dst_stock.current_quantity;
    new_avg_price := dst_stock.average_price;
    new_total_value := dst_stock.total_value;
  ELSIF src_stock.material_id IS NOT NULL THEN
    new_total_qty := src_stock.current_quantity;
    new_avg_price := src_stock.average_price;
    new_total_value := src_stock.total_value;
  ELSE
    new_total_qty := 0;
    new_avg_price := 0;
    new_total_value := 0;
  END IF;
  
  merge_result := jsonb_build_object(
    'src_material', to_jsonb(src_material),
    'dst_material', to_jsonb(dst_material),
    'new_stock_qty', new_total_qty,
    'new_avg_price', new_avg_price,
    'new_total_value', new_total_value,
    'dry_run', dry_run
  );
  
  IF NOT dry_run THEN
    -- Update all foreign key references
    UPDATE public.recipe_bom_items SET material_id = dst WHERE material_id = src;
    UPDATE public.composite_bom_items SET component_material_id = dst WHERE component_material_id = src;
    UPDATE public.event_table_items SET material_id = dst WHERE material_id = src;
    UPDATE public.event_table_template_items SET material_id = dst WHERE material_id = src;
    UPDATE public.invoice_items SET material_id = dst WHERE material_id = src;
    UPDATE public.supplier_products SET material_id = dst WHERE material_id = src;
    UPDATE public.event_production_order_items SET material_id = dst WHERE material_id = src;
    
    -- Update stock
    IF dst_stock.material_id IS NOT NULL THEN
      UPDATE public.stock_items 
      SET 
        current_quantity = new_total_qty,
        average_price = new_avg_price,
        total_value = new_total_value,
        updated_at = now()
      WHERE material_id = dst;
    ELSIF src_stock.material_id IS NOT NULL THEN
      UPDATE public.stock_items 
      SET material_id = dst
      WHERE material_id = src;
    END IF;
    
    -- Remove source stock if exists
    DELETE FROM public.stock_items WHERE material_id = src;
    
    -- Archive source material
    PERFORM public.archive_material(src);
    
    -- Log the merge
    INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
    VALUES (
      'MERGE_MATERIALS',
      merge_result || jsonb_build_object('executed', true),
      auth.uid()
    );
  END IF;
  
  RETURN merge_result;
END;
$$;
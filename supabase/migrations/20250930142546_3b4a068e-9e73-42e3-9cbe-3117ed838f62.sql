-- Fix rpc_inventory_add_materials to set physical_quantity default value
CREATE OR REPLACE FUNCTION public.rpc_inventory_add_materials(
  p_cycle_id UUID,
  p_material_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_system_qty NUMERIC;
BEGIN
  -- Check if cycle exists and is in draft status
  IF NOT EXISTS (
    SELECT 1 FROM inventory_cycles 
    WHERE id = p_cycle_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Cycle not found or not in draft status';
  END IF;

  -- Add each material to the cycle
  FOREACH v_material_id IN ARRAY p_material_ids
  LOOP
    -- Skip if material already exists in this cycle
    IF EXISTS (
      SELECT 1 FROM inventory_adjustments 
      WHERE cycle_id = p_cycle_id AND material_id = v_material_id
    ) THEN
      CONTINUE;
    END IF;

    -- Get current stock quantity
    SELECT COALESCE(current_quantity, 0) INTO v_system_qty
    FROM stock_items
    WHERE material_id = v_material_id;

    -- If no stock record exists, use 0
    IF v_system_qty IS NULL THEN
      v_system_qty := 0;
    END IF;

    -- Insert inventory adjustment record with physical_quantity = 0 (will be filled during counting)
    INSERT INTO inventory_adjustments (
      cycle_id,
      material_id,
      adjustment_date,
      adjustment_time,
      system_quantity,
      physical_quantity,
      adjustment_reason,
      responsible_user_id,
      is_draft
    ) VALUES (
      p_cycle_id,
      v_material_id,
      CURRENT_DATE,
      CURRENT_TIME,
      v_system_qty,
      0, -- Default value for physical_quantity, will be updated during counting
      'Contagem de inventário',
      auth.uid(),
      true
    );
  END LOOP;
END;
$$;
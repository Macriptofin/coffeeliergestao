-- Corrigir função process_inventory_adjustment para usar tipo de movimento válido
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
  p_material_id UUID,
  p_physical_quantity NUMERIC,
  p_adjustment_reason TEXT,
  p_reference_document TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_quantity NUMERIC;
  v_adjustment_id UUID;
  v_quantity_diff NUMERIC;
BEGIN
  -- Get current system quantity
  SELECT COALESCE(current_quantity, 0) INTO v_system_quantity
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- If no stock record exists, create one
  IF v_system_quantity IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, minimum_quantity)
    VALUES (p_material_id, 0, 0);
    v_system_quantity := 0;
  END IF;
  
  -- Calculate difference
  v_quantity_diff := p_physical_quantity - v_system_quantity;
  
  -- Create inventory adjustment record
  INSERT INTO public.inventory_adjustments (
    material_id,
    system_quantity,
    physical_quantity,
    adjustment_reason,
    reference_document,
    responsible_user_id,
    notes
  ) VALUES (
    p_material_id,
    v_system_quantity,
    p_physical_quantity,
    p_adjustment_reason,
    p_reference_document,
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_adjustment_id;
  
  -- Update stock quantity if there's a difference
  IF v_quantity_diff != 0 THEN
    UPDATE public.stock_items
    SET 
      current_quantity = p_physical_quantity,
      last_movement_date = now(),
      updated_at = now()
    WHERE material_id = p_material_id;
    
    -- Create stock movement record for audit trail using "Ajuste" as movement_type
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      p_material_id,
      'Ajuste',
      ABS(v_quantity_diff),
      'inventory_adjustment',
      v_adjustment_id,
      CASE 
        WHEN v_quantity_diff > 0 THEN 'Ajuste Positivo: ' || p_adjustment_reason
        ELSE 'Ajuste Negativo: ' || p_adjustment_reason
      END
    );
  END IF;
  
  RETURN v_adjustment_id;
END;
$$;
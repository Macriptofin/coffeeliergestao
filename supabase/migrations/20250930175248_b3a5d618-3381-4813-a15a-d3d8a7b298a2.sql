
-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS public.rpc_inventory_add_materials(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.rpc_inventory_create_cycle(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_inventory_update_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_inventory_finalize(UUID);

-- ============================================================
-- RPCs para Ciclos de Inventário (RECRIADAS)
-- ============================================================

-- 1) Criar ciclo
CREATE FUNCTION public.rpc_inventory_create_cycle(
  p_name TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  INSERT INTO inventory_cycles (name, notes, status, created_by)
  VALUES (p_name, p_notes, 'draft', auth.uid())
  RETURNING id INTO v_cycle_id;
  
  RETURN v_cycle_id;
END;
$$;

-- 2) Adicionar materiais ao ciclo
CREATE FUNCTION public.rpc_inventory_add_materials(
  p_cycle_id UUID,
  p_material_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_current_qty NUMERIC;
  v_added_count INTEGER := 0;
BEGIN
  FOREACH v_material_id IN ARRAY p_material_ids
  LOOP
    -- Verificar se já existe
    IF EXISTS (
      SELECT 1 FROM inventory_adjustments 
      WHERE cycle_id = p_cycle_id AND material_id = v_material_id
    ) THEN
      CONTINUE;
    END IF;
    
    -- Buscar quantidade atual
    SELECT COALESCE(current_quantity, 0) INTO v_current_qty
    FROM stock_items WHERE material_id = v_material_id;
    
    IF v_current_qty IS NULL THEN
      v_current_qty := 0;
    END IF;
    
    -- Criar ajuste em rascunho
    INSERT INTO inventory_adjustments (
      cycle_id,
      material_id,
      system_quantity,
      physical_quantity,
      adjustment_reason,
      is_draft,
      responsible_user_id
    ) VALUES (
      p_cycle_id,
      v_material_id,
      v_current_qty,
      NULL,
      'Contagem de inventário',
      TRUE,
      auth.uid()
    );
    
    v_added_count := v_added_count + 1;
  END LOOP;
  
  RETURN v_added_count;
END;
$$;

-- 3) Atualizar status do ciclo
CREATE FUNCTION public.rpc_inventory_update_status(
  p_cycle_id UUID,
  p_new_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory_cycles
  SET status = p_new_status,
      started_at = CASE 
        WHEN p_new_status = 'counting' AND started_at IS NULL 
        THEN NOW() 
        ELSE started_at 
      END
  WHERE id = p_cycle_id;
END;
$$;

-- 4) Finalizar ciclo (CORRIGIDO - atualiza stock_items!)
CREATE FUNCTION public.rpc_inventory_finalize(
  p_cycle_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjustment RECORD;
  v_materials_affected INTEGER := 0;
BEGIN
  -- Marcar ajustes como não-draft e atualizar stock_items
  FOR v_adjustment IN
    SELECT 
      ia.id,
      ia.material_id,
      ia.system_quantity,
      ia.physical_quantity,
      (ia.physical_quantity - ia.system_quantity) as diff
    FROM inventory_adjustments ia
    WHERE ia.cycle_id = p_cycle_id
      AND ia.is_draft = TRUE
      AND ia.physical_quantity IS NOT NULL
  LOOP
    -- Marcar ajuste como finalizado
    UPDATE inventory_adjustments
    SET is_draft = FALSE,
        quantity_difference = v_adjustment.diff
    WHERE id = v_adjustment.id;
    
    -- Garantir que stock_items existe
    INSERT INTO stock_items (material_id, current_quantity, minimum_quantity, average_price, total_value)
    VALUES (v_adjustment.material_id, 0, 0, 0, 0)
    ON CONFLICT (material_id) DO NOTHING;
    
    -- Atualizar stock_items
    UPDATE stock_items
    SET current_quantity = v_adjustment.physical_quantity,
        last_movement_date = NOW(),
        updated_at = NOW()
    WHERE material_id = v_adjustment.material_id;
    
    -- Criar movimento de estoque para auditoria
    IF v_adjustment.diff != 0 THEN
      INSERT INTO stock_movements (
        material_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes
      ) VALUES (
        v_adjustment.material_id,
        CASE WHEN v_adjustment.diff > 0 THEN 'Ajuste Positivo' ELSE 'Ajuste Negativo' END,
        ABS(v_adjustment.diff),
        'inventory_cycle',
        p_cycle_id,
        'Ajuste de inventário via ciclo'
      );
    END IF;
    
    v_materials_affected := v_materials_affected + 1;
  END LOOP;
  
  -- Fechar ciclo
  UPDATE inventory_cycles
  SET status = 'closed',
      closed_at = NOW(),
      closed_by = auth.uid()
  WHERE id = p_cycle_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'materials_affected', v_materials_affected
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.rpc_inventory_create_cycle TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_add_materials TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_update_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_finalize TO authenticated;

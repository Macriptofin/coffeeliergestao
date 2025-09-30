
-- Forçar atualização de stock_items baseado nos ajustes finalizados mais recentes
DO $$
DECLARE
  v_adjustment RECORD;
BEGIN
  -- Para cada material que tem ajustes finalizados mas stock_items desatualizados
  FOR v_adjustment IN
    SELECT DISTINCT ON (ia.material_id)
      ia.material_id,
      ia.physical_quantity,
      ia.cycle_id
    FROM inventory_adjustments ia
    WHERE ia.is_draft = FALSE
      AND ia.physical_quantity IS NOT NULL
      AND ia.material_id IN (
        SELECT id FROM materials WHERE code IN ('INS0121', 'INS0122')
      )
    ORDER BY ia.material_id, ia.created_at DESC
  LOOP
    -- Garantir que stock_items existe
    INSERT INTO stock_items (material_id, current_quantity, minimum_quantity, average_price, total_value)
    VALUES (v_adjustment.material_id, 0, 0, 0, 0)
    ON CONFLICT (material_id) DO NOTHING;
    
    -- Atualizar quantidade
    UPDATE stock_items
    SET current_quantity = v_adjustment.physical_quantity,
        last_movement_date = NOW(),
        updated_at = NOW()
    WHERE material_id = v_adjustment.material_id;
    
    -- Criar movimento de estoque (usando tipo correto)
    INSERT INTO stock_movements (
      material_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_adjustment.material_id,
      'Ajuste',  -- Tipo correto
      v_adjustment.physical_quantity,
      'Ajuste',  -- Reference type correto
      v_adjustment.cycle_id,
      'Correção retroativa de inventário'
    );
  END LOOP;
END $$;

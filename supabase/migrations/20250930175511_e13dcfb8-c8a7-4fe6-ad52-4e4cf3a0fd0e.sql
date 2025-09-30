
-- Correção: Criar stock_items baseado nos ajustes finalizados que não têm stock_items
DO $$
DECLARE
  v_adjustment RECORD;
BEGIN
  FOR v_adjustment IN
    SELECT 
      ia.material_id,
      ia.physical_quantity,
      m.usage_unit
    FROM inventory_adjustments ia
    JOIN materials m ON m.id = ia.material_id
    WHERE ia.is_draft = FALSE
      AND ia.physical_quantity IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stock_items si WHERE si.material_id = ia.material_id
      )
    GROUP BY ia.material_id, ia.physical_quantity, m.usage_unit
    -- Pegar apenas o ajuste mais recente de cada material
    HAVING ia.physical_quantity = (
      SELECT physical_quantity FROM inventory_adjustments ia2 
      WHERE ia2.material_id = ia.material_id 
        AND ia2.is_draft = FALSE 
      ORDER BY ia2.created_at DESC LIMIT 1
    )
  LOOP
    -- Criar stock_items
    INSERT INTO stock_items (
      material_id, 
      current_quantity, 
      minimum_quantity, 
      average_price, 
      total_value,
      last_movement_date,
      updated_at
    ) VALUES (
      v_adjustment.material_id,
      v_adjustment.physical_quantity,
      0,
      0,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (material_id) DO UPDATE SET
      current_quantity = v_adjustment.physical_quantity,
      last_movement_date = NOW(),
      updated_at = NOW();
      
    RAISE NOTICE 'Created/updated stock_items for material %', v_adjustment.material_id;
  END LOOP;
END $$;

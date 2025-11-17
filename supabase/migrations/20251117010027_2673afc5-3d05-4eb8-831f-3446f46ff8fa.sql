-- Implementar atualização em cascata de custos de BOMs quando preço de material muda
DROP FUNCTION IF EXISTS trigger_refresh_bom_costs_on_material_price_change(uuid);

CREATE OR REPLACE FUNCTION trigger_refresh_bom_costs_on_material_price_change(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_record RECORD;
  v_new_cost NUMERIC;
BEGIN
  -- 1. Atualizar recipes_bom que usam o material diretamente
  FOR v_bom_record IN
    SELECT DISTINCT rb.id, rb.finished_material_id
    FROM recipes_bom rb
    INNER JOIN recipe_items ri ON ri.recipe_id = rb.id
    WHERE ri.material_id = p_material_id
      AND rb.is_archived = false
  LOOP
    -- Recalcular custo da receita
    SELECT COALESCE(SUM(
      ri.quantity * COALESCE(si.average_price, 0)
    ), 0)
    INTO v_new_cost
    FROM recipe_items ri
    LEFT JOIN stock_items si ON si.material_id = ri.material_id
    WHERE ri.recipe_id = v_bom_record.id;
    
    -- Atualizar cached_total_cost
    UPDATE recipes_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;
    
    -- Atualizar custo do material acabado na stock_items se existir
    UPDATE stock_items
    SET 
      average_price = CASE 
        WHEN current_quantity > 0 THEN v_new_cost
        ELSE average_price
      END,
      cost_source = 'calculated',
      cost_last_updated_at = now()
    WHERE material_id = v_bom_record.finished_material_id
      AND manual_price = false;
  END LOOP;

  -- 2. Atualizar composites_bom que usam o material diretamente
  FOR v_bom_record IN
    SELECT DISTINCT cb.id, cb.composite_material_id
    FROM composites_bom cb
    INNER JOIN composite_bom_items ci ON ci.composite_id = cb.id
    WHERE ci.component_material_id = p_material_id
      AND cb.is_archived = false
  LOOP
    -- Recalcular custo do composto
    SELECT COALESCE(SUM(
      ci.quantity * COALESCE(si.average_price, 0)
    ), 0)
    INTO v_new_cost
    FROM composite_bom_items ci
    LEFT JOIN stock_items si ON si.material_id = ci.component_material_id
    WHERE ci.composite_id = v_bom_record.id;
    
    -- Atualizar cached_total_cost
    UPDATE composites_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;
    
    -- Atualizar custo do material composto na stock_items se existir
    UPDATE stock_items
    SET 
      average_price = CASE 
        WHEN current_quantity > 0 THEN v_new_cost
        ELSE average_price
      END,
      cost_source = 'calculated',
      cost_last_updated_at = now()
    WHERE material_id = v_bom_record.composite_material_id
      AND manual_price = false;
  END LOOP;

  -- 3. Recursivamente atualizar BOMs de segundo nível e além
  -- (BOMs que usam materiais cujo custo acabou de ser atualizado)
  FOR v_bom_record IN
    SELECT DISTINCT si.material_id
    FROM stock_items si
    WHERE si.cost_last_updated_at >= now() - interval '1 second'
      AND si.material_id != p_material_id
      AND si.cost_source = 'calculated'
  LOOP
    -- Chamada recursiva para propagar a mudança
    PERFORM trigger_refresh_bom_costs_on_material_price_change(v_bom_record.material_id);
  END LOOP;

END;
$$;

COMMENT ON FUNCTION trigger_refresh_bom_costs_on_material_price_change(uuid) IS 
'Atualiza em cascata os custos de todas as fichas técnicas (recipes_bom e composites_bom) que usam o material especificado, propagando recursivamente para BOMs de nível superior';
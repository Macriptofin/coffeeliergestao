-- Corrigir função de atualização em cascata de custos de BOMs
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
  -- 1) Recalcular recipes_bom que usam diretamente o material informado
  FOR v_bom_record IN
    SELECT DISTINCT rb.id, rb.finished_material_id
    FROM recipes_bom rb
    JOIN recipe_bom_items rbi ON rbi.recipe_id = rb.id
    WHERE rbi.material_id = p_material_id
      AND COALESCE(rb.is_archived, false) = false
  LOOP
    SELECT COALESCE(SUM(
      rbi.quantity * COALESCE(si.average_price, 0)
    ), 0)
    INTO v_new_cost
    FROM recipe_bom_items rbi
    LEFT JOIN stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = v_bom_record.id;

    UPDATE recipes_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;

    -- Propagar para BOMs de nível superior que usam o material acabado desta receita
    PERFORM trigger_refresh_bom_costs_on_material_price_change(v_bom_record.finished_material_id);
  END LOOP;

  -- 2) Recalcular composites_bom que usam diretamente o material informado
  FOR v_bom_record IN
    SELECT DISTINCT cb.id, cb.composite_material_id
    FROM composites_bom cb
    JOIN composite_bom_items cbi ON cbi.composite_id = cb.id
    WHERE cbi.component_material_id = p_material_id
      AND COALESCE(cb.is_archived, false) = false
  LOOP
    SELECT COALESCE(SUM(
      cbi.quantity * COALESCE(si.average_price, 0)
    ), 0)
    INTO v_new_cost
    FROM composite_bom_items cbi
    LEFT JOIN stock_items si ON si.material_id = cbi.component_material_id
    WHERE cbi.composite_id = v_bom_record.id;

    UPDATE composites_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;

    -- Propagar para BOMs de nível superior que usam o material composto
    PERFORM trigger_refresh_bom_costs_on_material_price_change(v_bom_record.composite_material_id);
  END LOOP;

END;
$$;

COMMENT ON FUNCTION trigger_refresh_bom_costs_on_material_price_change(uuid) IS 
'Atualiza em cascata os custos de todas as fichas técnicas (recipes_bom e composites_bom) que usam o material especificado, propagando recursivamente para BOMs de nível superior';
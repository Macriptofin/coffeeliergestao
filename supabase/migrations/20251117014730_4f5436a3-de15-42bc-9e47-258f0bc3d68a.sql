-- Adicionar campos de status de custo nas tabelas de BOM
ALTER TABLE recipes_bom 
ADD COLUMN IF NOT EXISTS cost_status TEXT DEFAULT 'unknown' CHECK (cost_status IN ('complete', 'incomplete', 'partial', 'unknown')),
ADD COLUMN IF NOT EXISTS missing_cost_items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE composites_bom 
ADD COLUMN IF NOT EXISTS cost_status TEXT DEFAULT 'unknown' CHECK (cost_status IN ('complete', 'incomplete', 'partial', 'unknown')),
ADD COLUMN IF NOT EXISTS missing_cost_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN recipes_bom.cost_status IS 'Status do cálculo de custo: complete (todos os itens têm custo), incomplete (alguns itens sem custo), partial (usando fallbacks), unknown (não calculado)';
COMMENT ON COLUMN recipes_bom.missing_cost_items IS 'Array de material_ids que não possuem custo definido';

COMMENT ON COLUMN composites_bom.cost_status IS 'Status do cálculo de custo: complete (todos os itens têm custo), incomplete (alguns itens sem custo), partial (usando fallbacks), unknown (não calculado)';
COMMENT ON COLUMN composites_bom.missing_cost_items IS 'Array de material_ids que não possuem custo definido';

-- Recriar função de atualização em cascata com fallback e detecção de custos incompletos
DROP FUNCTION IF EXISTS trigger_refresh_bom_costs_on_material_price_change(uuid);

CREATE OR REPLACE FUNCTION trigger_refresh_bom_costs_on_material_price_change(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_record RECORD;
  v_item_record RECORD;
  v_new_cost NUMERIC := 0;
  v_item_cost NUMERIC;
  v_missing_items JSONB := '[]'::jsonb;
  v_has_incomplete BOOLEAN := false;
  v_has_fallback BOOLEAN := false;
  v_cost_status TEXT;
  v_yield_quantity NUMERIC;
  v_unit_cost NUMERIC;
BEGIN
  -- 1) Recalcular recipes_bom que usam diretamente o material informado
  FOR v_bom_record IN
    SELECT DISTINCT rb.id, rb.finished_material_id, rb.yield_quantity
    FROM recipes_bom rb
    JOIN recipe_bom_items rbi ON rbi.recipe_id = rb.id
    WHERE rbi.material_id = p_material_id
      AND COALESCE(rb.is_archived, false) = false
  LOOP
    v_new_cost := 0;
    v_missing_items := '[]'::jsonb;
    v_has_incomplete := false;
    v_has_fallback := false;
    
    -- Calcular custo item por item, detectando problemas
    FOR v_item_record IN
      SELECT 
        rbi.material_id,
        rbi.quantity,
        m.name as material_name,
        m.material_type,
        si.average_price as stock_price,
        rb2.cached_total_cost as bom_cost,
        rb2.yield_quantity as bom_yield
      FROM recipe_bom_items rbi
      JOIN materials m ON m.id = rbi.material_id
      LEFT JOIN stock_items si ON si.material_id = rbi.material_id
      LEFT JOIN recipes_bom rb2 ON rb2.finished_material_id = rbi.material_id AND rb2.is_archived = false
      WHERE rbi.recipe_id = v_bom_record.id
    LOOP
      -- Prioridade 1: Preço do estoque
      IF v_item_record.stock_price IS NOT NULL AND v_item_record.stock_price > 0 THEN
        v_item_cost := v_item_record.quantity * v_item_record.stock_price;
        
      -- Prioridade 2: Custo da BOM (para intermediários/acabados)
      ELSIF v_item_record.material_type IN ('intermediate_product', 'finished_product', 'composite_product')
            AND v_item_record.bom_cost IS NOT NULL 
            AND v_item_record.bom_yield IS NOT NULL 
            AND v_item_record.bom_yield > 0 THEN
        -- Usar custo unitário da BOM como fallback
        v_item_cost := v_item_record.quantity * (v_item_record.bom_cost / v_item_record.bom_yield);
        v_has_fallback := true;
        
      -- Sem custo disponível
      ELSE
        v_item_cost := 0;
        v_has_incomplete := true;
        v_missing_items := v_missing_items || jsonb_build_object(
          'material_id', v_item_record.material_id,
          'material_name', v_item_record.material_name,
          'quantity', v_item_record.quantity
        );
      END IF;
      
      v_new_cost := v_new_cost + v_item_cost;
    END LOOP;
    
    -- Determinar status do custo
    IF v_has_incomplete THEN
      v_cost_status := 'incomplete';
    ELSIF v_has_fallback THEN
      v_cost_status := 'partial';
    ELSE
      v_cost_status := 'complete';
    END IF;
    
    -- Atualizar BOM com novo custo e status
    UPDATE recipes_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_status = v_cost_status,
      missing_cost_items = v_missing_items,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;
    
    -- CRÍTICO: Atualizar average_price no stock_items do produto acabado
    -- para que a recursão funcione corretamente
    IF v_bom_record.yield_quantity IS NOT NULL AND v_bom_record.yield_quantity > 0 THEN
      v_unit_cost := v_new_cost / v_bom_record.yield_quantity;
      
      UPDATE stock_items
      SET 
        average_price = v_unit_cost,
        cost_source = 'production',
        cost_last_updated_at = now()
      WHERE material_id = v_bom_record.finished_material_id;
      
      -- Se não existe stock_item, criar um
      INSERT INTO stock_items (
        material_id,
        current_quantity,
        average_price,
        total_value,
        cost_source,
        cost_last_updated_at
      )
      SELECT
        v_bom_record.finished_material_id,
        0,
        v_unit_cost,
        0,
        'production',
        now()
      WHERE NOT EXISTS (
        SELECT 1 FROM stock_items WHERE material_id = v_bom_record.finished_material_id
      );
    END IF;
    
    -- Propagar recursivamente para BOMs de nível superior
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
    v_new_cost := 0;
    v_missing_items := '[]'::jsonb;
    v_has_incomplete := false;
    v_has_fallback := false;
    
    -- Calcular custo item por item
    FOR v_item_record IN
      SELECT 
        cbi.component_material_id as material_id,
        cbi.quantity,
        m.name as material_name,
        m.material_type,
        si.average_price as stock_price,
        cb2.cached_total_cost as bom_cost
      FROM composite_bom_items cbi
      JOIN materials m ON m.id = cbi.component_material_id
      LEFT JOIN stock_items si ON si.material_id = cbi.component_material_id
      LEFT JOIN composites_bom cb2 ON cb2.composite_material_id = cbi.component_material_id AND cb2.is_archived = false
      WHERE cbi.composite_id = v_bom_record.id
    LOOP
      -- Prioridade 1: Preço do estoque
      IF v_item_record.stock_price IS NOT NULL AND v_item_record.stock_price > 0 THEN
        v_item_cost := v_item_record.quantity * v_item_record.stock_price;
        
      -- Prioridade 2: Custo da BOM composta
      ELSIF v_item_record.material_type = 'composite_product'
            AND v_item_record.bom_cost IS NOT NULL THEN
        v_item_cost := v_item_record.quantity * v_item_record.bom_cost;
        v_has_fallback := true;
        
      -- Sem custo disponível
      ELSE
        v_item_cost := 0;
        v_has_incomplete := true;
        v_missing_items := v_missing_items || jsonb_build_object(
          'material_id', v_item_record.material_id,
          'material_name', v_item_record.material_name,
          'quantity', v_item_record.quantity
        );
      END IF;
      
      v_new_cost := v_new_cost + v_item_cost;
    END LOOP;
    
    -- Determinar status do custo
    IF v_has_incomplete THEN
      v_cost_status := 'incomplete';
    ELSIF v_has_fallback THEN
      v_cost_status := 'partial';
    ELSE
      v_cost_status := 'complete';
    END IF;
    
    -- Atualizar BOM composta
    UPDATE composites_bom
    SET 
      cached_total_cost = v_new_cost,
      cost_status = v_cost_status,
      missing_cost_items = v_missing_items,
      cost_last_calculated_at = now()
    WHERE id = v_bom_record.id;
    
    -- CRÍTICO: Atualizar average_price no stock_items do produto composto
    UPDATE stock_items
    SET 
      average_price = v_new_cost,
      cost_source = 'production',
      cost_last_updated_at = now()
    WHERE material_id = v_bom_record.composite_material_id;
    
    -- Se não existe stock_item, criar um
    INSERT INTO stock_items (
      material_id,
      current_quantity,
      average_price,
      total_value,
      cost_source,
      cost_last_updated_at
    )
    SELECT
      v_bom_record.composite_material_id,
      0,
      v_new_cost,
      0,
      'production',
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_items WHERE material_id = v_bom_record.composite_material_id
    );
    
    -- Propagar recursivamente
    PERFORM trigger_refresh_bom_costs_on_material_price_change(v_bom_record.composite_material_id);
  END LOOP;

END;
$$;

COMMENT ON FUNCTION trigger_refresh_bom_costs_on_material_price_change(uuid) IS 
'Atualiza em cascata os custos de BOMs usando fallbacks (custo BOM para intermediários sem estoque) e marca status de custos incompletos';
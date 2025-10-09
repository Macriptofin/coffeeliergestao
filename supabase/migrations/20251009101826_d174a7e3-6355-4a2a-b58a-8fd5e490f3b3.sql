-- Função para recalcular custos de produtos no estoque baseado em suas BOMs
-- Útil para corrigir histórico ou atualizar custos quando ingredientes mudam de preço
CREATE OR REPLACE FUNCTION public.recalculate_product_stock_cost(p_material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_bom RECORD;
  v_total_cost numeric := 0;
  v_unit_cost numeric;
  v_current_qty numeric;
  v_ingredient_cost numeric;
  v_bom_item RECORD;
BEGIN
  -- 1. Buscar material e validar
  SELECT * INTO v_material
  FROM public.materials
  WHERE id = p_material_id
    AND material_type IN ('finished_product', 'intermediate_product');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Material não encontrado ou não é produto acabado/intermediário'
    );
  END IF;

  -- 2. Buscar quantidade atual em estoque
  SELECT current_quantity INTO v_current_qty
  FROM public.stock_items
  WHERE material_id = p_material_id;

  IF v_current_qty IS NULL OR v_current_qty = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Material não possui estoque para recalcular custo'
    );
  END IF;

  -- 3. Buscar BOM ativa
  SELECT * INTO v_bom
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id
    AND is_archived = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOM não encontrada para este material'
    );
  END IF;

  -- Validar yield_quantity
  IF v_bom.yield_quantity IS NULL OR v_bom.yield_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOM com yield_quantity inválido'
    );
  END IF;

  -- 4. Calcular custo total baseado nos ingredientes atuais
  FOR v_bom_item IN
    SELECT 
      rbi.material_id,
      rbi.quantity,
      rbi.unit,
      m.name,
      COALESCE(si.average_price, m.price_per_purchase_unit / NULLIF(m.conversion_factor, 0), 0) as ingredient_price
    FROM public.recipe_bom_items rbi
    JOIN public.materials m ON m.id = rbi.material_id
    LEFT JOIN public.stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = v_bom.id
  LOOP
    -- Validar preço do ingrediente
    IF v_bom_item.ingredient_price IS NULL OR v_bom_item.ingredient_price <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Ingrediente %s sem preço definido', v_bom_item.name)
      );
    END IF;

    -- Calcular custo do ingrediente (para 1 batch da receita)
    v_ingredient_cost := v_bom_item.quantity * v_bom_item.ingredient_price;
    v_total_cost := v_total_cost + v_ingredient_cost;
  END LOOP;

  -- 5. Calcular custo unitário (custo total / rendimento)
  v_unit_cost := v_total_cost / v_bom.yield_quantity;

  -- 6. Atualizar estoque com novo custo
  UPDATE public.stock_items
  SET 
    average_price = v_unit_cost,
    total_value = v_current_qty * v_unit_cost,
    cost_source = 'production',
    cost_last_updated_at = now(),
    cost_last_updated_by = auth.uid(),
    updated_at = now()
  WHERE material_id = p_material_id;

  -- 7. Registrar no histórico de ajustes
  INSERT INTO public.cost_adjustments (
    material_id,
    adjustment_date,
    adjustment_time,
    adjustment_reason,
    old_unit_cost,
    new_unit_cost,
    current_quantity,
    old_total_value,
    new_total_value,
    cost_difference,
    responsible_user_id,
    notes
  )
  SELECT
    p_material_id,
    CURRENT_DATE,
    CURRENT_TIME,
    'Recálculo baseado em BOM',
    COALESCE(si.average_price, 0),
    v_unit_cost,
    v_current_qty,
    COALESCE(si.total_value, 0),
    v_current_qty * v_unit_cost,
    (v_current_qty * v_unit_cost) - COALESCE(si.total_value, 0),
    auth.uid(),
    format('Recálculo automático - BOM ID: %s', v_bom.id)
  FROM public.stock_items si
  WHERE si.material_id = p_material_id;

  -- 8. Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'material_id', p_material_id,
    'material_name', v_material.name,
    'current_quantity', v_current_qty,
    'unit_cost', v_unit_cost,
    'total_cost', v_total_cost,
    'yield_quantity', v_bom.yield_quantity,
    'new_total_value', v_current_qty * v_unit_cost,
    'cost_source', 'production',
    'bom_id', v_bom.id
  );
END;
$$;

COMMENT ON FUNCTION public.recalculate_product_stock_cost IS 'Recalcula o custo no estoque de um produto acabado/intermediário baseado em sua BOM atual, sem alterar quantidades físicas. Útil para corrigir custos históricos ou atualizar após mudança de preço de ingredientes.';
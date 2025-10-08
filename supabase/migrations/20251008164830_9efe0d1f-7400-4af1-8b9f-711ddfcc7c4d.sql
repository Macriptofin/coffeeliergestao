
-- Corrigir valores de reference_type nas funções de produção
-- O constraint permite apenas: 'Compra', 'Producao', 'Ajuste', 'Perda'

-- 1. Recriar função produce_finished_product com reference_type correto
CREATE OR REPLACE FUNCTION public.produce_finished_product(p_material_id uuid, p_quantity numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_material RECORD;
  v_bom RECORD;
  v_bom_item RECORD;
  v_required_qty numeric;
  v_available_qty numeric;
  v_total_cost numeric := 0;
  v_unit_cost numeric;
  v_produced_qty numeric;
  v_current_stock numeric;
  v_current_avg_price numeric;
  v_new_avg_price numeric;
  v_result jsonb;
BEGIN
  -- 1. Validar material
  SELECT * INTO v_material
  FROM public.materials
  WHERE id = p_material_id
    AND material_type IN ('finished_product', 'intermediate_product');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material inválido ou não é produto acabado/intermediário');
  END IF;

  -- 2. Buscar BOM
  SELECT * INTO v_bom
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id
    AND is_archived = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada para este material');
  END IF;

  -- 3. Validar estoque de ingredientes
  FOR v_bom_item IN
    SELECT rbi.*, m.name
    FROM public.recipe_bom_items rbi
    JOIN public.materials m ON m.id = rbi.material_id
    WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    SELECT current_quantity INTO v_available_qty
    FROM public.stock_items
    WHERE material_id = v_bom_item.material_id;

    IF v_available_qty IS NULL OR v_available_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Estoque insuficiente: %s (necessário: %s, disponível: %s)',
          v_bom_item.name, v_required_qty, COALESCE(v_available_qty, 0))
      );
    END IF;
  END LOOP;

  -- 4. Consumir ingredientes e calcular custo total
  FOR v_bom_item IN
    SELECT rbi.*, si.average_price
    FROM public.recipe_bom_items rbi
    JOIN public.stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    -- Baixar do estoque
    UPDATE public.stock_items
    SET current_quantity = current_quantity - v_required_qty,
        total_value = (current_quantity - v_required_qty) * average_price,
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = v_bom_item.material_id;

    -- Registrar movimentação de saída (CORRIGIDO: reference_type = 'Producao')
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_cost,
      reference_type,
      reference_id
    ) VALUES (
      v_bom_item.material_id,
      'Consumo Produção',
      v_required_qty,
      v_bom_item.average_price,
      v_required_qty * v_bom_item.average_price,
      'Producao',
      v_bom.id
    );

    -- Acumular custo
    v_total_cost := v_total_cost + (v_required_qty * v_bom_item.average_price);
  END LOOP;

  -- 5. Calcular quantidade produzida e custo unitário
  v_produced_qty := v_bom.yield_quantity * p_quantity;
  v_unit_cost := v_total_cost / v_produced_qty;

  -- 6. Buscar estoque atual do produto acabado (com lock)
  SELECT current_quantity, average_price
  INTO v_current_stock, v_current_avg_price
  FROM public.stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;

  -- 7. Calcular novo preço médio ponderado
  IF v_current_stock IS NULL OR v_current_stock = 0 THEN
    -- Não há estoque anterior: usar custo da produção
    v_new_avg_price := v_unit_cost;

    INSERT INTO public.stock_items (
      material_id,
      current_quantity,
      average_price,
      total_value,
      cost_source,
      manual_price,
      cost_last_updated_at,
      cost_last_updated_by
    ) VALUES (
      p_material_id,
      v_produced_qty,
      v_new_avg_price,
      v_produced_qty * v_new_avg_price,
      'production',
      false,
      now(),
      auth.uid()
    );
  ELSE
    -- Há estoque anterior: calcular média ponderada
    v_new_avg_price := (
      (v_current_stock * v_current_avg_price) + (v_produced_qty * v_unit_cost)
    ) / (v_current_stock + v_produced_qty);

    UPDATE public.stock_items
    SET current_quantity = v_current_stock + v_produced_qty,
        average_price = v_new_avg_price,
        total_value = (v_current_stock + v_produced_qty) * v_new_avg_price,
        cost_source = 'production',
        cost_last_updated_at = now(),
        cost_last_updated_by = auth.uid(),
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = p_material_id;
  END IF;

  -- 8. Registrar movimentação de entrada (CORRIGIDO: reference_type = 'Producao')
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_cost,
    reference_type,
    reference_id
  ) VALUES (
    p_material_id,
    'Entrada Produção',
    v_produced_qty,
    v_unit_cost,
    v_total_cost,
    'Producao',
    v_bom.id
  );

  -- 9. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'material_id', p_material_id,
    'produced_quantity', v_produced_qty,
    'unit_cost', v_unit_cost,
    'total_cost', v_total_cost,
    'new_avg_price', v_new_avg_price,
    'cost_source', 'production'
  );
END;
$$;

-- 2. Recriar função assemble_composite com reference_type correto
CREATE OR REPLACE FUNCTION public.assemble_composite(p_material_id uuid, p_quantity numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_material RECORD;
  v_bom RECORD;
  v_bom_item RECORD;
  v_required_qty numeric;
  v_available_qty numeric;
  v_total_cost numeric := 0;
BEGIN
  -- 1. Validar material
  SELECT * INTO v_material
  FROM public.materials
  WHERE id = p_material_id
    AND material_type = 'composite_product';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material inválido ou não é produto composto');
  END IF;

  -- 2. Buscar BOM
  SELECT * INTO v_bom
  FROM public.composites_bom
  WHERE composite_material_id = p_material_id
    AND is_archived = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada para este material');
  END IF;

  -- 3. Validar estoque de componentes
  FOR v_bom_item IN
    SELECT cbi.*, m.name
    FROM public.composite_bom_items cbi
    JOIN public.materials m ON m.id = cbi.component_material_id
    WHERE cbi.composite_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    SELECT current_quantity INTO v_available_qty
    FROM public.stock_items
    WHERE material_id = v_bom_item.component_material_id;

    IF v_available_qty IS NULL OR v_available_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Estoque insuficiente: %s (necessário: %s, disponível: %s)',
          v_bom_item.name, v_required_qty, COALESCE(v_available_qty, 0))
      );
    END IF;
  END LOOP;

  -- 4. Consumir componentes e calcular custo total
  FOR v_bom_item IN
    SELECT cbi.*, si.average_price
    FROM public.composite_bom_items cbi
    JOIN public.stock_items si ON si.material_id = cbi.component_material_id
    WHERE cbi.composite_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    -- Baixar do estoque
    UPDATE public.stock_items
    SET current_quantity = current_quantity - v_required_qty,
        total_value = (current_quantity - v_required_qty) * average_price,
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = v_bom_item.component_material_id;

    -- Registrar movimentação de saída (CORRIGIDO: reference_type = 'Producao')
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_cost,
      reference_type,
      reference_id
    ) VALUES (
      v_bom_item.component_material_id,
      'Consumo Montagem',
      v_required_qty,
      v_bom_item.average_price,
      v_required_qty * v_bom_item.average_price,
      'Producao',
      v_bom.id
    );

    -- Acumular custo
    v_total_cost := v_total_cost + (v_required_qty * v_bom_item.average_price);
  END LOOP;

  -- 5. Adicionar produto composto ao estoque
  INSERT INTO public.stock_items (
    material_id,
    current_quantity,
    average_price,
    total_value,
    cost_source,
    cost_last_updated_at,
    cost_last_updated_by
  ) VALUES (
    p_material_id,
    p_quantity,
    v_total_cost / p_quantity,
    v_total_cost,
    'production',
    now(),
    auth.uid()
  )
  ON CONFLICT (material_id) DO UPDATE SET
    current_quantity = stock_items.current_quantity + EXCLUDED.current_quantity,
    average_price = EXCLUDED.average_price,
    total_value = (stock_items.current_quantity + EXCLUDED.current_quantity) * EXCLUDED.average_price,
    cost_source = 'production',
    cost_last_updated_at = now(),
    cost_last_updated_by = auth.uid(),
    last_movement_date = now(),
    updated_at = now();

  -- 6. Registrar movimentação de entrada (CORRIGIDO: reference_type = 'Producao')
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_cost,
    reference_type,
    reference_id
  ) VALUES (
    p_material_id,
    'Entrada Montagem',
    p_quantity,
    v_total_cost / p_quantity,
    v_total_cost,
    'Producao',
    v_bom.id
  );

  -- 7. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'material_id', p_material_id,
    'assembled_quantity', p_quantity,
    'unit_cost', v_total_cost / p_quantity,
    'total_cost', v_total_cost,
    'cost_source', 'production'
  );
END;
$$;

-- 3. Audit log
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'FIX_PRODUCTION_REFERENCE_TYPE',
  jsonb_build_object(
    'timestamp', now(),
    'changes', ARRAY[
      'Corrigido reference_type de production para Producao',
      'Corrigido reference_type de assembly para Producao',
      'Funções produce_finished_product e assemble_composite atualizadas'
    ],
    'reason', 'Constraint stock_movements_reference_type_check só permite: Compra, Producao, Ajuste, Perda'
  ),
  auth.uid()
);

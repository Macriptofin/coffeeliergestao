-- ============================================
-- CORREÇÃO DA FUNÇÃO produce_finished_product
-- ============================================
-- Problema: unit_price e total_cost estão NULL nas movimentações
-- Causa: Cálculo incorreto ou falta de validação
-- Solução: Corrigir cálculo e adicionar validações

CREATE OR REPLACE FUNCTION public.produce_finished_product(p_material_id uuid, p_quantity numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_ingredient_cost numeric;
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

  -- Validar yield_quantity
  IF v_bom.yield_quantity IS NULL OR v_bom.yield_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM com yield_quantity inválido');
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

    -- VALIDAÇÃO CRÍTICA: Garantir que average_price existe
    IF v_bom_item.average_price IS NULL OR v_bom_item.average_price <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Material %s sem preço médio definido no estoque', v_bom_item.material_id)
      );
    END IF;

    -- Calcular custo do ingrediente
    v_ingredient_cost := v_required_qty * v_bom_item.average_price;

    -- Baixar do estoque
    UPDATE public.stock_items
    SET current_quantity = current_quantity - v_required_qty,
        total_value = (current_quantity - v_required_qty) * average_price,
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = v_bom_item.material_id;

    -- Inserir movimento de SAÍDA com custos
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_cost,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_bom_item.material_id,
      'Consumo Produção',
      v_required_qty,
      v_bom_item.average_price,  -- CRÍTICO: Gravar unit_price
      v_ingredient_cost,          -- CRÍTICO: Gravar total_cost
      'Producao',
      v_bom.id,
      format('Consumido para produção de %s unidades de %s', p_quantity, v_material.name)
    );

    -- Acumular custo total
    v_total_cost := v_total_cost + v_ingredient_cost;
  END LOOP;

  -- VALIDAÇÃO: Garantir que total_cost foi calculado
  IF v_total_cost IS NULL OR v_total_cost <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro no cálculo do custo total da produção'
    );
  END IF;

  -- 5. Calcular quantidade produzida e custo unitário
  v_produced_qty := v_bom.yield_quantity * p_quantity;
  v_unit_cost := v_total_cost / v_produced_qty;

  RAISE NOTICE 'PRODUÇÃO DEBUG: total_cost=%, produced_qty=%, unit_cost=%', v_total_cost, v_produced_qty, v_unit_cost;

  -- 6. Buscar estoque atual do produto acabado
  SELECT current_quantity, average_price
  INTO v_current_stock, v_current_avg_price
  FROM public.stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;

  -- 7. Calcular novo preço médio ponderado e atualizar estoque
  IF v_current_stock IS NULL OR v_current_stock = 0 THEN
    -- Primeira entrada - criar stock_item
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
      'production',  -- CRÍTICO: Marcar como production
      false,
      now(),
      auth.uid()
    );
  ELSE
    -- Já existe estoque - calcular média ponderada
    v_new_avg_price := (
      (v_current_stock * v_current_avg_price) + (v_produced_qty * v_unit_cost)
    ) / (v_current_stock + v_produced_qty);

    UPDATE public.stock_items
    SET current_quantity = v_current_stock + v_produced_qty,
        average_price = v_new_avg_price,
        total_value = (v_current_stock + v_produced_qty) * v_new_avg_price,
        cost_source = 'production',  -- CRÍTICO: Marcar como production
        cost_last_updated_at = now(),
        cost_last_updated_by = auth.uid(),
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = p_material_id;
  END IF;

  -- 8. Inserir movimento de ENTRADA com custos
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,     -- CRÍTICO: Gravar unit_cost
    total_cost,     -- CRÍTICO: Gravar total_cost
    reference_type,
    reference_id,
    notes
  ) VALUES (
    p_material_id,
    'Entrada Produção',
    v_produced_qty,
    v_unit_cost,    -- CRÍTICO: Custo unitário
    v_total_cost,   -- CRÍTICO: Custo total
    'Producao',
    v_bom.id,
    format('Produção de %s unidades - Custo unitário: R$ %.4f/un', p_quantity, v_unit_cost)
  );

  -- 9. Retornar sucesso com detalhes
  RETURN jsonb_build_object(
    'success', true,
    'material_id', p_material_id,
    'produced_quantity', v_produced_qty,
    'unit_cost', v_unit_cost,
    'total_cost', v_total_cost,
    'new_avg_price', v_new_avg_price,
    'cost_source', 'production',
    'bom_id', v_bom.id
  );
END;
$function$;

-- ============================================
-- FUNÇÃO PARA LIMPAR DADOS CORROMPIDOS
-- ============================================
CREATE OR REPLACE FUNCTION public.fix_corrupted_production_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corrupted_movements INTEGER := 0;
  v_fixed_movements INTEGER := 0;
  v_corrupted_stock INTEGER := 0;
  v_fixed_stock INTEGER := 0;
BEGIN
  -- 1. Identificar movimentações corrompidas
  SELECT COUNT(*) INTO v_corrupted_movements
  FROM stock_movements
  WHERE reference_type = 'Producao'
    AND movement_type IN ('Entrada Produção', 'Consumo Produção')
    AND (unit_price IS NULL OR total_cost IS NULL);

  -- 2. Identificar stock_items com cost_source incorreto
  SELECT COUNT(*) INTO v_corrupted_stock
  FROM stock_items si
  JOIN materials m ON m.id = si.material_id
  WHERE m.material_type IN ('finished_product', 'intermediate_product')
    AND si.cost_source != 'production'
    AND EXISTS (
      SELECT 1 FROM stock_movements sm
      WHERE sm.material_id = si.material_id
        AND sm.reference_type = 'Producao'
        AND sm.movement_type = 'Entrada Produção'
    );

  -- 3. Corrigir cost_source de produtos produzidos
  UPDATE stock_items si
  SET cost_source = 'production',
      cost_last_updated_at = now(),
      cost_last_updated_by = auth.uid()
  FROM materials m
  WHERE m.id = si.material_id
    AND m.material_type IN ('finished_product', 'intermediate_product')
    AND si.cost_source != 'production'
    AND EXISTS (
      SELECT 1 FROM stock_movements sm
      WHERE sm.material_id = si.material_id
        AND sm.reference_type = 'Producao'
        AND sm.movement_type = 'Entrada Produção'
    );

  GET DIAGNOSTICS v_fixed_stock = ROW_COUNT;

  -- Retornar relatório
  RETURN jsonb_build_object(
    'corrupted_movements', v_corrupted_movements,
    'corrupted_stock', v_corrupted_stock,
    'fixed_stock', v_fixed_stock,
    'message', format('Corrigidos %s registros de estoque. %s movimentações com custos NULL precisam ser recriadas.',
      v_fixed_stock, v_corrupted_movements)
  );
END;
$function$;

COMMENT ON FUNCTION public.produce_finished_product IS 'Executa produção de produtos acabados/intermediários consumindo ingredientes e calculando custos corretamente';
COMMENT ON FUNCTION public.fix_corrupted_production_costs IS 'Corrige dados corrompidos de produções anteriores';
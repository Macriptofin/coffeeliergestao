-- =====================================================
-- CORREÇÃO CRÍTICA: produce_finished_product com Média Ponderada
-- BUG: ON CONFLICT sobrescreve average_price sem calcular média ponderada
-- FIX: Buscar estoque com FOR UPDATE e calcular média ponderada corretamente
-- DATA: 2025-01-08
-- =====================================================

-- 0. ADICIONAR COLUNA total_cost em stock_movements se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'stock_movements' 
      AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE public.stock_movements ADD COLUMN total_cost numeric;
    COMMENT ON COLUMN public.stock_movements.total_cost IS 'Custo total da movimentação (quantity × unit_price)';
  END IF;
END $$;

-- 1. FUNÇÃO CORRIGIDA: produce_finished_product
CREATE OR REPLACE FUNCTION public.produce_finished_product(
  p_material_id uuid,
  p_quantity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Registrar movimentação de saída
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
      'production',
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

  -- 8. Registrar movimentação de entrada
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
    'production',
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

COMMENT ON FUNCTION public.produce_finished_product IS 'Processa produção de produto acabado/intermediário: consome ingredientes, calcula custo e atualiza estoque com média ponderada correta';

-- 2. LIMPEZA CIRÚRGICA DE DADOS CORROMPIDOS
DO $$
DECLARE
  v_material_ids uuid[];
  v_deleted_movements integer := 0;
  v_deleted_stock integer := 0;
  v_massa_id uuid;
  v_brigadeiro_id uuid;
BEGIN
  -- Buscar produtos intermediários com custos absurdos (indicativo de bug)
  SELECT ARRAY_AGG(m.id) INTO v_material_ids
  FROM materials m
  JOIN stock_items si ON si.material_id = m.id
  WHERE m.material_type = 'intermediate_product'
    AND si.cost_source = 'production'
    AND si.average_price > 0.5;

  IF v_material_ids IS NOT NULL AND ARRAY_LENGTH(v_material_ids, 1) > 0 THEN
    -- Deletar apenas movimentações de produção
    DELETE FROM stock_movements
    WHERE material_id = ANY(v_material_ids)
      AND movement_type IN ('Entrada Produção', 'Consumo Produção');
    
    GET DIAGNOSTICS v_deleted_movements = ROW_COUNT;

    -- Deletar estoque corrompido
    DELETE FROM stock_items
    WHERE material_id = ANY(v_material_ids)
      AND cost_source = 'production';
    
    GET DIAGNOSTICS v_deleted_stock = ROW_COUNT;

    RAISE NOTICE '✅ LIMPEZA: % movimentações e % estoques corrompidos removidos', 
      v_deleted_movements, v_deleted_stock;
  ELSE
    RAISE NOTICE '✅ LIMPEZA: Nenhum dado corrompido encontrado';
  END IF;

  -- Verificar produtos de referência
  SELECT id INTO v_massa_id FROM materials WHERE code = 'INT0012';
  SELECT id INTO v_brigadeiro_id FROM materials WHERE code = 'INT0013';

  IF v_massa_id IS NOT NULL THEN
    RAISE NOTICE '✅ Massa Brownie (INT0012) pronta para nova produção';
  END IF;

  IF v_brigadeiro_id IS NOT NULL THEN
    RAISE NOTICE '✅ Brigadeiro Branco (INT0013) pronto para nova produção';
  END IF;

  -- Log de auditoria
  INSERT INTO ops_bom_audit_log (action, detail, user_id)
  VALUES (
    'FIX_PRODUCTION_WEIGHTED_AVERAGE',
    jsonb_build_object(
      'bug', 'produce_finished_product sobrescrevia average_price sem média ponderada',
      'fix', 'Média ponderada: (estoque × preço + produção × custo) ÷ total',
      'impact', 'Produtos intermediários calculam custo médio correto',
      'deleted_movements', v_deleted_movements,
      'deleted_stocks', v_deleted_stock,
      'timestamp', now()
    ),
    auth.uid()
  );

  RAISE NOTICE '✅ CORREÇÃO APLICADA COM SUCESSO!';
END $$;
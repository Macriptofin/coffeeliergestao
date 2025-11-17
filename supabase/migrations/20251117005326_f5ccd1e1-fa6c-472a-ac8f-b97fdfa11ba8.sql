-- Corrigir process_cost_adjustment para não inserir em colunas geradas
DROP FUNCTION IF EXISTS process_cost_adjustment(UUID, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION process_cost_adjustment(
  p_material_id UUID,
  p_new_unit_cost NUMERIC,
  p_adjustment_reason TEXT,
  p_reference_document TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_stock_item RECORD;
  v_old_unit_cost NUMERIC;
  v_current_quantity NUMERIC;
  v_adjustment_id UUID;
  v_old_total_value NUMERIC;
  v_new_total_value NUMERIC;
BEGIN
  -- Buscar informações atuais do estoque
  SELECT 
    current_quantity,
    average_price,
    total_value
  INTO v_stock_item
  FROM stock_items
  WHERE material_id = p_material_id;

  IF NOT FOUND THEN
    -- Criar stock_item se não existir
    INSERT INTO stock_items (
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
      0,
      p_new_unit_cost,
      0,
      'manual',
      true,
      now(),
      auth.uid()
    );
    
    v_old_unit_cost := 0;
    v_current_quantity := 0;
    v_old_total_value := 0;
    v_new_total_value := 0;
  ELSE
    v_old_unit_cost := COALESCE(v_stock_item.average_price, 0);
    v_current_quantity := COALESCE(v_stock_item.current_quantity, 0);
    v_old_total_value := COALESCE(v_stock_item.total_value, 0);
    v_new_total_value := p_new_unit_cost * v_current_quantity;

    -- Atualizar stock_item com novo custo
    UPDATE stock_items
    SET 
      average_price = p_new_unit_cost,
      total_value = v_new_total_value,
      cost_source = 'manual',
      manual_price = true,
      cost_last_updated_at = now(),
      cost_last_updated_by = auth.uid(),
      updated_at = now()
    WHERE material_id = p_material_id;
  END IF;

  -- Inserir registro de ajuste (apenas colunas não-geradas)
  INSERT INTO cost_adjustments (
    material_id,
    old_unit_cost,
    new_unit_cost,
    current_quantity,
    adjustment_reason,
    reference_document,
    notes,
    responsible_user_id
  ) VALUES (
    p_material_id,
    v_old_unit_cost,
    p_new_unit_cost,
    v_current_quantity,
    p_adjustment_reason,
    p_reference_document,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_adjustment_id;

  -- Atualizar custos em cascata para BOMs que usam este material
  PERFORM trigger_refresh_bom_costs_on_material_price_change(p_material_id);

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'old_cost', v_old_unit_cost,
    'new_cost', p_new_unit_cost,
    'cost_difference', p_new_unit_cost - v_old_unit_cost,
    'old_total_value', v_old_total_value,
    'new_total_value', v_new_total_value,
    'value_difference', v_new_total_value - v_old_total_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION process_cost_adjustment IS 
'Processa ajuste manual de custo de material - versão corrigida que não insere em colunas geradas (old_total_value, new_total_value, cost_difference)';
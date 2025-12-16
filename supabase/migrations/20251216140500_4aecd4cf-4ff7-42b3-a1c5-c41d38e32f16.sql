-- Criar versão da função calculate_weighted_average_price que aceita apenas material_id
-- Esta função é chamada pelo trigger trg_update_weighted_average em stock_movements
-- Ela recalcula a média ponderada baseada nos movimentos de entrada e propaga para BOMs

CREATE OR REPLACE FUNCTION public.calculate_weighted_average_price(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_value NUMERIC := 0;
  v_total_quantity NUMERIC := 0;
  v_new_avg_price NUMERIC := 0;
  v_current_stock RECORD;
  v_old_price NUMERIC;
BEGIN
  -- Buscar estado atual do estoque
  SELECT current_quantity, average_price
  INTO v_current_stock
  FROM stock_items
  WHERE material_id = p_material_id;
  
  -- Se não existe registro de estoque, não há o que fazer
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  v_old_price := COALESCE(v_current_stock.average_price, 0);
  
  -- Calcular média ponderada baseada em TODOS os movimentos de entrada
  -- (Entrada, Compra, Entrada NF, PURCHASE)
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity), 0)
  INTO v_total_value, v_total_quantity
  FROM stock_movements
  WHERE material_id = p_material_id
    AND movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'PURCHASE')
    AND unit_price IS NOT NULL
    AND unit_price > 0;
  
  -- Calcular novo preço médio
  IF v_total_quantity > 0 THEN
    v_new_avg_price := v_total_value / v_total_quantity;
  ELSE
    -- Se não há movimentos de entrada, manter o preço atual
    v_new_avg_price := v_old_price;
  END IF;
  
  -- Só atualizar se o preço realmente mudou (evita loops e atualizações desnecessárias)
  IF v_new_avg_price IS DISTINCT FROM v_old_price AND v_new_avg_price > 0 THEN
    -- Atualizar stock_items com novo preço médio
    UPDATE stock_items
    SET 
      average_price = v_new_avg_price,
      total_value = current_quantity * v_new_avg_price,
      cost_source = COALESCE(cost_source, 'purchase'),
      cost_last_updated_at = NOW(),
      updated_at = NOW()
    WHERE material_id = p_material_id;
    
    -- Propagar para BOMs que usam este material (mantém a cascata de custos)
    -- Isso atualiza fichas técnicas e produtos compostos que dependem deste material
    PERFORM trigger_refresh_bom_costs_on_material_price_change(p_material_id);
  END IF;
  
END;
$function$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.calculate_weighted_average_price(uuid) IS 
'Recalcula o preço médio ponderado de um material baseado nos movimentos de entrada. 
Chamada automaticamente pelo trigger trg_update_weighted_average após inserções em stock_movements.
Propaga as alterações de custo para BOMs que usam o material (cascata de custos).';

-- ============================================
-- TRIGGERS AUTOMÁTICOS DE PRECIFICAÇÃO
-- ============================================

-- 1. TRIGGER: Atualizar preço médio automaticamente em entradas de compra
CREATE OR REPLACE FUNCTION trigger_update_weighted_average_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processar em INSERT de movimentações tipo 'Entrada' ou 'Compra'
  IF (NEW.movement_type IN ('Entrada', 'Compra', 'Entrada NF') 
      AND NEW.unit_price IS NOT NULL 
      AND NEW.unit_price > 0) THEN
    
    -- Chamar função de cálculo de média ponderada
    PERFORM calculate_weighted_average_price(NEW.material_id);
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger
DROP TRIGGER IF EXISTS trg_update_weighted_average ON stock_movements;
CREATE TRIGGER trg_update_weighted_average
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_weighted_average_on_purchase();

-- 2. TRIGGER: Atualizar stock_items.current_quantity automaticamente
CREATE OR REPLACE FUNCTION trigger_sync_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty NUMERIC;
BEGIN
  -- Calcular quantidade atual somando todas as movimentações
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução') 
      THEN quantity
      WHEN movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda')
      THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_current_qty
  FROM stock_movements
  WHERE material_id = NEW.material_id;
  
  -- Atualizar ou criar stock_item
  INSERT INTO stock_items (
    material_id,
    current_quantity,
    average_price,
    total_value,
    last_movement_date,
    updated_at
  ) VALUES (
    NEW.material_id,
    v_current_qty,
    COALESCE(NEW.unit_price, 0),
    v_current_qty * COALESCE(NEW.unit_price, 0),
    NEW.movement_date,
    now()
  )
  ON CONFLICT (material_id) DO UPDATE SET
    current_quantity = v_current_qty,
    total_value = CASE 
      WHEN stock_items.average_price > 0 
      THEN v_current_qty * stock_items.average_price
      ELSE stock_items.total_value
    END,
    last_movement_date = NEW.movement_date,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger
DROP TRIGGER IF EXISTS trg_sync_stock_quantity ON stock_movements;
CREATE TRIGGER trg_sync_stock_quantity
  AFTER INSERT OR UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_stock_quantity();

-- 3. TRIGGER: Atualizar custos de BOMs quando material componente muda de preço
CREATE OR REPLACE FUNCTION trigger_update_bom_costs_on_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processar se o preço médio mudou significativamente (>0.1%)
  IF (NEW.average_price IS DISTINCT FROM OLD.average_price) 
     AND ABS(COALESCE(NEW.average_price, 0) - COALESCE(OLD.average_price, 0)) > 0.01 THEN
    
    -- Chamar função que atualiza custos de todas as BOMs que usam este material
    PERFORM trigger_refresh_bom_costs_on_material_price_change(NEW.material_id);
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger
DROP TRIGGER IF EXISTS trg_update_bom_costs ON stock_items;
CREATE TRIGGER trg_update_bom_costs
  AFTER UPDATE ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_bom_costs_on_price_change();

-- 4. CORREÇÃO RETROATIVA: Preencher custos faltantes nas 398 movimentações
-- Para movimentações de consumo de produção, usar o preço médio do momento
UPDATE stock_movements sm
SET 
  unit_price = COALESCE(si.average_price, m.price_per_purchase_unit / COALESCE(m.conversion_factor, 1)),
  total_cost = quantity * COALESCE(si.average_price, m.price_per_purchase_unit / COALESCE(m.conversion_factor, 1))
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE sm.material_id = m.id
  AND (sm.unit_price IS NULL OR sm.unit_price = 0)
  AND sm.movement_type IN ('Consumo Produção', 'Saída', 'Consumo')
  AND COALESCE(si.average_price, m.price_per_purchase_unit) > 0;

-- Para movimentações de entrada sem preço, marcar como precisando revisão
UPDATE stock_movements
SET notes = COALESCE(notes || ' | ', '') || '[REVISAR: Entrada sem preço - favor atualizar manualmente]'
WHERE (unit_price IS NULL OR unit_price = 0)
  AND movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção')
  AND total_cost IS NULL;

-- Comentários para documentação
COMMENT ON FUNCTION trigger_update_weighted_average_on_purchase() IS 
'Trigger que atualiza automaticamente o preço médio ponderado quando há entrada de compra';

COMMENT ON FUNCTION trigger_sync_stock_quantity() IS 
'Trigger que mantém stock_items.current_quantity sempre sincronizado com stock_movements';

COMMENT ON FUNCTION trigger_update_bom_costs_on_price_change() IS 
'Trigger que propaga mudanças de preço para todas as BOMs que usam o material como componente';

-- Corrigir lançamento incorreto da NF 765076
-- Os movimentos de estoque foram criados com unit_price sem conversão

-- 1. Identificar materiais afetados antes de deletar
DO $$
DECLARE
  affected_materials UUID[];
BEGIN
  -- Guardar lista de materiais afetados
  SELECT ARRAY_AGG(DISTINCT material_id) INTO affected_materials
  FROM stock_movements
  WHERE reference_id = '0323e83a-4c1a-4112-b493-b4fe78d25057';
  
  -- Deletar movimentos incorretos
  DELETE FROM stock_movements
  WHERE reference_id = '0323e83a-4c1a-4112-b493-b4fe78d25057';
  
  -- Recalcular estoque para cada material afetado
  FOR i IN 1..array_length(affected_materials, 1) LOOP
    -- Recalcular quantidade atual baseado em todos os movimentos restantes
    UPDATE stock_items si
    SET 
      current_quantity = COALESCE((
        SELECT SUM(
          CASE 
            WHEN sm.movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'PURCHASE', 'Produção', 'Ajuste Positivo') THEN sm.quantity
            WHEN sm.movement_type IN ('Saída', 'Venda', 'Consumo', 'Ajuste Negativo', 'CONSUMPTION') THEN -sm.quantity
            ELSE 0
          END
        )
        FROM stock_movements sm
        WHERE sm.material_id = affected_materials[i]
      ), 0),
      updated_at = NOW()
    WHERE si.material_id = affected_materials[i];
    
    -- Recalcular preço médio
    PERFORM calculate_weighted_average_price(affected_materials[i]);
  END LOOP;
END $$;

-- 2. Resetar status da nota fiscal para permitir relançamento
UPDATE purchase_invoices
SET 
  workflow_status = 'pendente',
  stock_posted = false,
  items_locked = false,
  updated_at = NOW()
WHERE id = '0323e83a-4c1a-4112-b493-b4fe78d25057';
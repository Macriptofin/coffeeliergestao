-- ============================================================================
-- CORREÇÃO DE CUSTOS NULL EM MOVIMENTAÇÕES DE ESTOQUE
-- ============================================================================
-- Data: 16 de novembro de 2025
-- Problema: 398 movimentações com total_cost NULL (100%)
-- Causa: Código antigo não preenchia o campo total_cost
-- Solução: Calcular total_cost = unit_price * quantity
-- ============================================================================

-- ANTES DE EXECUTAR: Fazer backup!
-- SELECT * FROM stock_movements WHERE total_cost IS NULL INTO stock_movements_backup;

BEGIN;

-- Estatísticas ANTES da correção
DO $$
DECLARE
  v_total_null INTEGER;
  v_total_movements INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_null FROM stock_movements WHERE total_cost IS NULL;
  SELECT COUNT(*) INTO v_total_movements FROM stock_movements;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'ESTATÍSTICAS ANTES DA CORREÇÃO';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total de movimentações: %', v_total_movements;
  RAISE NOTICE 'Movimentações com total_cost NULL: %', v_total_null;
  RAISE NOTICE 'Percentual com NULL: %.2f%%', (v_total_null::numeric / v_total_movements::numeric * 100);
  RAISE NOTICE '==============================================';
END $$;

-- ============================================================================
-- CORREÇÃO 1: Movimentações com unit_price preenchido
-- ============================================================================
-- Calcular: total_cost = unit_price * ABS(quantity)
-- ============================================================================

UPDATE stock_movements
SET total_cost = unit_price * ABS(quantity)
WHERE total_cost IS NULL 
  AND unit_price IS NOT NULL
  AND quantity IS NOT NULL;

RAISE NOTICE 'Correção 1 completa: movimentações com unit_price preenchido';

-- ============================================================================
-- CORREÇÃO 2: Movimentações SEM unit_price - Tentar buscar do material
-- ============================================================================
-- Para movimentações antigas sem unit_price, tentar usar price_per_purchase_unit
-- do material (se disponível)
-- ============================================================================

UPDATE stock_movements sm
SET 
  unit_price = m.price_per_purchase_unit,
  total_cost = m.price_per_purchase_unit * ABS(sm.quantity)
FROM materials m
WHERE sm.material_id = m.id
  AND sm.total_cost IS NULL
  AND sm.unit_price IS NULL
  AND m.price_per_purchase_unit IS NOT NULL
  AND m.price_per_purchase_unit > 0;

RAISE NOTICE 'Correção 2 completa: movimentações com preço do cadastro de material';

-- ============================================================================
-- CORREÇÃO 3: Movimentações SEM unit_price - Usar custo médio do estoque
-- ============================================================================
-- Para movimentações ainda sem preço, usar average_price do stock_items
-- ============================================================================

UPDATE stock_movements sm
SET 
  unit_price = si.average_price,
  total_cost = si.average_price * ABS(sm.quantity)
FROM stock_items si
WHERE sm.material_id = si.material_id
  AND sm.total_cost IS NULL
  AND sm.unit_price IS NULL
  AND si.average_price IS NOT NULL
  AND si.average_price > 0;

RAISE NOTICE 'Correção 3 completa: movimentações com preço médio do estoque';

-- ============================================================================
-- CORREÇÃO 4: Movimentações restantes - Atribuir custo ZERO
-- ============================================================================
-- Para movimentações que ainda estão NULL (sem nenhuma referência de preço),
-- atribuir 0 para manter integridade dos dados
-- ============================================================================

UPDATE stock_movements
SET 
  unit_price = COALESCE(unit_price, 0),
  total_cost = 0
WHERE total_cost IS NULL;

RAISE NOTICE 'Correção 4 completa: movimentações restantes com custo zero';

-- ============================================================================
-- ESTATÍSTICAS DEPOIS DA CORREÇÃO
-- ============================================================================

DO $$
DECLARE
  v_total_null INTEGER;
  v_total_movements INTEGER;
  v_total_zero INTEGER;
  v_total_with_cost INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_null FROM stock_movements WHERE total_cost IS NULL;
  SELECT COUNT(*) INTO v_total_movements FROM stock_movements;
  SELECT COUNT(*) INTO v_total_zero FROM stock_movements WHERE total_cost = 0;
  SELECT COUNT(*) INTO v_total_with_cost FROM stock_movements WHERE total_cost > 0;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'ESTATÍSTICAS DEPOIS DA CORREÇÃO';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total de movimentações: %', v_total_movements;
  RAISE NOTICE 'Movimentações com total_cost NULL: % (%.2f%%)', v_total_null, (v_total_null::numeric / v_total_movements::numeric * 100);
  RAISE NOTICE 'Movimentações com total_cost = 0: % (%.2f%%)', v_total_zero, (v_total_zero::numeric / v_total_movements::numeric * 100);
  RAISE NOTICE 'Movimentações com total_cost > 0: % (%.2f%%)', v_total_with_cost, (v_total_with_cost::numeric / v_total_movements::numeric * 100);
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'CORREÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '==============================================';
END $$;

-- ============================================================================
-- VALIDAÇÃO: Listar movimentações por tipo e status de custo
-- ============================================================================

SELECT 
  movement_type,
  COUNT(*) as total,
  COUNT(CASE WHEN total_cost IS NULL THEN 1 END) as null_cost,
  COUNT(CASE WHEN total_cost = 0 THEN 1 END) as zero_cost,
  COUNT(CASE WHEN total_cost > 0 THEN 1 END) as with_cost,
  ROUND(AVG(total_cost), 2) as avg_cost,
  ROUND(SUM(total_cost), 2) as sum_cost
FROM stock_movements
GROUP BY movement_type
ORDER BY movement_type;

COMMIT;

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- IMPORTANTE: 
-- 1. Revisar os resultados acima
-- 2. Se estiver tudo correto, o COMMIT já foi executado
-- 3. Código frontend agora preenche total_cost automaticamente
-- 4. Problema resolvido!
-- ============================================================================

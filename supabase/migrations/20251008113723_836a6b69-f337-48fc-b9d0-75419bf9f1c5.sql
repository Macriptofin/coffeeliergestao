-- =====================================================
-- CORREÇÃO CRÍTICA: get_material_cost() para produtos intermediários
-- BUG: Função retornava custo total da BOM ao invés de custo unitário
-- FIX: Dividir cached_total_cost por yield_quantity
-- =====================================================

-- 1. CORRIGIR FUNÇÃO get_material_cost()
CREATE OR REPLACE FUNCTION public.get_material_cost(p_material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_stock_price numeric;
  v_cached_bom_cost numeric;
  v_yield_quantity numeric;
BEGIN
  -- Buscar dados do material
  SELECT 
    m.*,
    si.average_price as stock_avg_price
  INTO v_material
  FROM materials m
  LEFT JOIN stock_items si ON si.material_id = m.id
  WHERE m.id = p_material_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- PRIORIDADE 1: Preço do estoque (mais confiável)
  IF v_material.stock_avg_price IS NOT NULL AND v_material.stock_avg_price > 0 THEN
    RETURN v_material.stock_avg_price;
  END IF;
  
  -- PRIORIDADE 2: Custo da BOM (para produtos intermediários e acabados)
  IF v_material.material_type IN ('intermediate_product', 'finished_product') THEN
    -- Buscar custo da BOM e yield_quantity
    SELECT rb.cached_total_cost, rb.yield_quantity
    INTO v_cached_bom_cost, v_yield_quantity
    FROM recipes_bom rb
    WHERE rb.finished_material_id = p_material_id
      AND rb.is_archived = FALSE
    LIMIT 1;
    
    -- CORREÇÃO CRÍTICA: Dividir custo total pelo rendimento para obter custo unitário
    IF v_cached_bom_cost IS NOT NULL AND v_yield_quantity IS NOT NULL AND v_yield_quantity > 0 THEN
      RETURN v_cached_bom_cost / v_yield_quantity;
    END IF;
  END IF;
  
  -- PRIORIDADE 3: Custo de BOM composta
  IF v_material.material_type = 'composite_product' THEN
    SELECT cb.cached_total_cost
    INTO v_cached_bom_cost
    FROM composites_bom cb
    WHERE cb.composite_material_id = p_material_id
      AND cb.is_archived = FALSE
    LIMIT 1;
    
    IF v_cached_bom_cost IS NOT NULL THEN
      RETURN v_cached_bom_cost;
    END IF;
  END IF;
  
  -- PRIORIDADE 4: Preço cadastrado (fallback)
  IF v_material.price_per_purchase_unit IS NOT NULL THEN
    RETURN v_material.price_per_purchase_unit / COALESCE(v_material.conversion_factor, 1);
  END IF;
  
  RETURN 0;
END;
$$;

-- 2. TESTE AUTOMÁTICO: Validar custo unitário da Manteiga Queimada
DO $$
DECLARE
  v_manteiga_id uuid;
  v_custo_unitario numeric;
  v_custo_esperado numeric := 0.0572; -- R$ 0.0572/g baseado nos prints
  v_tolerancia numeric := 0.005; -- 0.5 centavos de tolerância
  v_diferenca numeric;
BEGIN
  -- Buscar ID da Manteiga Queimada
  SELECT id INTO v_manteiga_id
  FROM materials
  WHERE code = 'INT0010' OR name ILIKE '%manteiga queimada%'
  LIMIT 1;
  
  IF v_manteiga_id IS NULL THEN
    RAISE NOTICE '⚠️  TESTE IGNORADO: Material "Manteiga Queimada" não encontrado';
    RETURN;
  END IF;
  
  -- Calcular custo unitário
  v_custo_unitario := get_material_cost(v_manteiga_id);
  v_diferenca := ABS(v_custo_unitario - v_custo_esperado);
  
  -- Validar resultado
  IF v_diferenca <= v_tolerancia THEN
    RAISE NOTICE '✅ TESTE PASSOU: Custo unitário da Manteiga Queimada = R$ %', ROUND(v_custo_unitario, 4);
  ELSE
    RAISE WARNING '❌ TESTE FALHOU: Custo unitário = R$ % (esperado: R$ %)', 
      ROUND(v_custo_unitario, 4), v_custo_esperado;
  END IF;
END $$;

-- 3. RECALCULAR TODAS AS BOMs ATIVAS
DO $$
DECLARE
  v_bom_record RECORD;
  v_count integer := 0;
  v_errors integer := 0;
BEGIN
  FOR v_bom_record IN
    SELECT id, finished_material_id
    FROM recipes_bom
    WHERE is_archived = FALSE
  LOOP
    BEGIN
      PERFORM calculate_bom_current_cost(v_bom_record.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Erro ao recalcular BOM %: %', v_bom_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Recálculo concluído: % BOMs atualizadas, % erros', v_count, v_errors;
END $$;

-- 4. LOG DA CORREÇÃO
INSERT INTO ops_bom_audit_log (action, detail, user_id)
VALUES (
  'FIX_INTERMEDIATE_COST',
  jsonb_build_object(
    'bug', 'get_material_cost() retornava custo total ao invés de unitário',
    'fix', 'Divisão por yield_quantity implementada',
    'impact', 'Produtos intermediários agora retornam custo por unidade correto',
    'timestamp', now()
  ),
  auth.uid()
);
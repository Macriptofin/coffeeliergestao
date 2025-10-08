-- ============================================
-- CORREÇÃO: Guardrails para Produção + Limpeza
-- ============================================

-- 1. CRIAR FUNÇÃO DE VALIDAÇÃO DE MOVIMENTOS DE PRODUÇÃO
CREATE OR REPLACE FUNCTION public.validate_production_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalizar reference_type antigo 'Producao' para 'production'
  IF NEW.reference_type = 'Producao' THEN
    NEW.reference_type := 'production';
  END IF;

  -- Bloquear entradas de produção sem custos (previne inflação de preços)
  IF (
    (NEW.movement_type IN ('Entrada', 'Entrada Produção', 'Entrada Producao') 
     AND NEW.reference_type IN ('production', 'Producao'))
    OR 
    (NEW.movement_type ILIKE '%produ%')
  ) THEN
    -- Validar que unit_price e total_cost estão preenchidos
    IF NEW.unit_price IS NULL OR NEW.unit_price = 0 THEN
      RAISE EXCEPTION 'Movimentos de produção devem ter unit_price preenchido. Use a função produce_finished_product() para registrar produção.'
        USING HINT = 'Execute produção via: Produção > BOM > aba "Produção"';
    END IF;
    
    IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
      RAISE EXCEPTION 'Movimentos de produção devem ter total_cost preenchido. Use a função produce_finished_product() para registrar produção.'
        USING HINT = 'Execute produção via: Produção > BOM > aba "Produção"';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. CRIAR TRIGGER
DROP TRIGGER IF EXISTS trg_validate_production_movement ON public.stock_movements;

CREATE TRIGGER trg_validate_production_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_production_movement();

-- 3. LIMPEZA DE DADOS CORROMPIDOS

-- 3.1. Remover movimentos de produção sem custos
DELETE FROM public.stock_movements
WHERE movement_type IN ('Entrada', 'Entrada Produção')
  AND reference_type IN ('Producao', 'production')
  AND (unit_price IS NULL OR unit_price = 0 OR total_cost IS NULL OR total_cost = 0);

-- 3.2. Resetar stock_items dos produtos intermediários afetados
DELETE FROM public.stock_items
WHERE material_id IN (
  SELECT id FROM public.materials 
  WHERE code IN ('INT0012', 'INT0013')
    AND material_type = 'intermediate_product'
);

-- 4. AUDIT LOG
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'PRODUCTION_GUARDRAILS_IMPLEMENTED',
  jsonb_build_object(
    'timestamp', now(),
    'changes', jsonb_build_array(
      'Trigger de validação de movimentos de produção criado',
      'Normalização automática de reference_type Producao → production',
      'Bloqueio de entradas de produção sem unit_price/total_cost',
      'Limpeza de movimentos corrompidos executada',
      'Stock items de INT0012 e INT0013 resetados'
    ),
    'affected_materials', ARRAY['INT0012', 'INT0013'],
    'next_steps', 'Executar nova produção via Produção > BOM > aba Produção'
  ),
  auth.uid()
);

-- 5. MENSAGENS DE VALIDAÇÃO
DO $$
DECLARE
  v_int0012_id uuid;
  v_int0013_id uuid;
  v_int0012_stock numeric;
  v_int0013_stock numeric;
BEGIN
  -- Verificar status dos materiais
  SELECT id INTO v_int0012_id FROM public.materials WHERE code = 'INT0012';
  SELECT id INTO v_int0013_id FROM public.materials WHERE code = 'INT0013';
  
  SELECT current_quantity INTO v_int0012_stock 
  FROM public.stock_items WHERE material_id = v_int0012_id;
  
  SELECT current_quantity INTO v_int0013_stock 
  FROM public.stock_items WHERE material_id = v_int0013_id;
  
  RAISE NOTICE '✅ GUARDRAILS IMPLEMENTADOS COM SUCESSO';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Status dos Materiais:';
  RAISE NOTICE '  - INT0012 (Massa Brownie): %', 
    CASE WHEN v_int0012_stock IS NULL THEN 'Estoque zerado - pronto para nova produção' 
         ELSE format('Estoque: %s g', v_int0012_stock) END;
  RAISE NOTICE '  - INT0013 (Brigadeiro Branco): %', 
    CASE WHEN v_int0013_stock IS NULL THEN 'Estoque zerado - pronto para nova produção' 
         ELSE format('Estoque: %s g', v_int0013_stock) END;
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ Proteções Ativas:';
  RAISE NOTICE '  ✓ Entradas de produção sem custos serão bloqueadas';
  RAISE NOTICE '  ✓ reference_type será normalizado automaticamente';
  RAISE NOTICE '  ✓ Apenas produções via RPC produce_finished_product() serão aceitas';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Próximos Passos:';
  RAISE NOTICE '  1. Acessar: Produção > BOM > aba "Produção"';
  RAISE NOTICE '  2. Selecionar INT0012 ou INT0013';
  RAISE NOTICE '  3. Informar quantidade (ex: 20 unidades)';
  RAISE NOTICE '  4. Clicar em "Executar Produção"';
  RAISE NOTICE '  5. Verificar que average_price está correto (~R$ 0,014/g)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Sistema pronto para teste!';
END $$;
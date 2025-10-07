-- ============================================================================
-- ETAPA 2: Backfill de Dados Históricos (CORRIGIDO v3)
-- ============================================================================

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_system_user_id UUID;
BEGIN
  SELECT user_id INTO v_system_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum admin encontrado. Usando NULL como cost_last_updated_by.';
  END IF;

  UPDATE public.stock_items
  SET 
    cost_source = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.material_id = stock_items.material_id
          AND sm.movement_type IN ('Compra', 'Entrada', 'purchase')
        ORDER BY sm.created_at DESC
        LIMIT 1
      ) THEN 'purchase'::cost_source_type
      ELSE 'manual'::cost_source_type
    END,
    cost_last_updated_at = COALESCE(
      (
        SELECT sm.created_at
        FROM public.stock_movements sm
        WHERE sm.material_id = stock_items.material_id
        ORDER BY sm.created_at DESC
        LIMIT 1
      ),
      stock_items.updated_at,
      stock_items.created_at,
      NOW()
    ),
    cost_last_updated_by = v_system_user_id,
    manual_price = TRUE
  WHERE cost_source IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Backfill: % registros atualizados', v_updated_count;

  INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
  VALUES (
    'BACKFILL_COST_TRACEABILITY',
    jsonb_build_object(
      'timestamp', NOW(),
      'updated_stock_items', v_updated_count,
      'system_user_id', v_system_user_id
    ),
    v_system_user_id
  );

END $$;

-- Estatísticas
DO $$
DECLARE
  v_total INTEGER;
  v_with_source INTEGER;
  v_purchase INTEGER;
  v_production INTEGER;
  v_manual INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.stock_items;
  SELECT COUNT(*) INTO v_with_source FROM public.stock_items WHERE cost_source IS NOT NULL;
  SELECT COUNT(*) INTO v_purchase FROM public.stock_items WHERE cost_source = 'purchase';
  SELECT COUNT(*) INTO v_production FROM public.stock_items WHERE cost_source = 'production';
  SELECT COUNT(*) INTO v_manual FROM public.stock_items WHERE cost_source = 'manual';

  RAISE NOTICE '=== ESTATÍSTICAS ===';
  RAISE NOTICE 'Total: %, Com origem: % (%.1f%%)', v_total, v_with_source, (v_with_source::NUMERIC / NULLIF(v_total, 0) * 100);
  RAISE NOTICE 'Purchase: %, Production: %, Manual: %', v_purchase, v_production, v_manual;
END $$;
-- CAUSA RAIZ (regressão introduzida na migration 0004): a entrada do produto
-- acabado passou a usar process_finish_input(), que insere movement_type='Entrada'
-- com reference_type='Producao'. O trigger validate_production_movement normaliza
-- 'Producao'->'production' e BLOQUEIA entradas de produção sem unit_price/total_cost.
--
-- O fluxo de OP NÃO calcula custo por movimento (o custo do acabado vem do BOM,
-- via cache de custo das fichas). O comportamento histórico que sempre funcionou
-- (46 ordens concluídas) era inserir a entrada DIRETAMENTE em stock_movements com
-- movement_type='Entrada' e reference_type='Ordem de Produção' — combinação que:
--   * é aceita pelo CHECK stock_movements_movement_type_check ('Entrada');
--   * NÃO é flagrada pelo validate trigger (reference_type 'Ordem de Produção' não
--     está na lista 'production'/'Producao');
--   * é reconhecida como POSITIVA pelo trigger_sync_stock_quantity, que recalcula
--     current_quantity a partir da soma de todos os movimentos (não precisamos
--     atualizar stock_items manualmente).
-- Restauramos esse caminho. As baixas (consumo + perdas) seguem por
-- process_order_component_consumption, já corrigido para 'Saída'/'Ordem de Produção'.
CREATE OR REPLACE FUNCTION public.finalize_production_order(p_production_order_id uuid, p_items jsonb DEFAULT '[]'::jsonb, p_losses jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text; v_elem jsonb; v_row record; v_actual_qty numeric;
BEGIN
  SELECT status INTO v_status FROM public.bom_production_orders WHERE id = p_production_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de produção não encontrada: %', p_production_order_id; END IF;
  IF v_status <> 'Em Produção' THEN
    RAISE EXCEPTION 'A ordem precisa estar Em Produção para ser finalizada (status atual: %)', v_status;
  END IF;

  -- Rendimentos reais
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    UPDATE public.bom_production_order_items
    SET actual_yield_quantity = (v_elem->>'actual_yield_quantity')::numeric,
        yield_notes           = v_elem->>'notes'
    WHERE id = (v_elem->>'bom_item_id')::uuid AND production_order_id = p_production_order_id;
  END LOOP;

  -- Registra perdas (log)
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_losses) LOOP
    INSERT INTO public.bom_production_losses (
      production_order_id, material_id, loss_quantity, loss_unit, loss_reason, notes, created_by
    ) VALUES (
      p_production_order_id, (v_elem->>'material_id')::uuid,
      (v_elem->>'loss_quantity')::numeric, v_elem->>'loss_unit',
      v_elem->>'loss_reason', v_elem->>'notes', auth.uid()
    );
  END LOOP;

  -- Consome ingredientes (conforme BOM) — process_order_component_consumption
  -- insere 'Saída'/'Ordem de Produção' em stock_movements (baixa de estoque).
  PERFORM public.consume_materials_for_production(p_production_order_id);

  -- Entrada dos produtos acabados (rendimento real) no estoque — inserção DIRETA
  -- compatível com o CHECK, o validate trigger e o sync trigger.
  FOR v_row IN
    SELECT poi.bom_id, poi.total_yield_quantity, poi.actual_yield_quantity, poi.yield_unit,
           rb.finished_material_id, m.name AS bom_name
    FROM public.bom_production_order_items poi
    JOIN public.recipes_bom rb ON rb.id = poi.bom_id
    JOIN public.materials m ON m.id = rb.finished_material_id
    WHERE poi.production_order_id = p_production_order_id
  LOOP
    v_actual_qty := COALESCE(v_row.actual_yield_quantity, v_row.total_yield_quantity);

    INSERT INTO public.stock_movements (
      material_id, movement_type, quantity, reference_type, reference_id, notes, movement_date
    ) VALUES (
      v_row.finished_material_id, 'Entrada', v_actual_qty, 'Ordem de Produção', p_production_order_id,
      format('Produção de %s — rendimento real: %s %s (planejado: %s)',
             v_row.bom_name, v_actual_qty, v_row.yield_unit, v_row.total_yield_quantity),
      now()
    );

    -- Ledger interno da OP (auditoria)
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, v_row.finished_material_id, 'Entrada', v_actual_qty, v_row.yield_unit,
      format('Produção de %s — rendimento real: %s %s (planejado: %s)',
             v_row.bom_name, v_actual_qty, v_row.yield_unit, v_row.total_yield_quantity),
      auth.uid()
    );
  END LOOP;

  -- BAIXA DAS PERDAS no estoque (após o rendimento entrar) — ingrediente OU produto acabado
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_losses) LOOP
    PERFORM public.process_order_component_consumption(
      (v_elem->>'material_id')::uuid,
      (v_elem->>'loss_quantity')::numeric,
      COALESCE(v_elem->>'loss_unit', 'un'),
      p_production_order_id
    );
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, (v_elem->>'material_id')::uuid, 'Saída',
      (v_elem->>'loss_quantity')::numeric, COALESCE(v_elem->>'loss_unit','un'),
      format('Perda na produção (%s)%s', COALESCE(NULLIF(v_elem->>'loss_reason',''),'—'),
             CASE WHEN COALESCE(v_elem->>'notes','') <> '' THEN ' - ' || (v_elem->>'notes') ELSE '' END),
      auth.uid()
    );
  END LOOP;

  UPDATE public.bom_production_orders
  SET status = 'Concluído', completed_at = now() WHERE id = p_production_order_id;
END;
$function$;

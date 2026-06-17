-- CAUSA RAIZ: finalize_production_order referenciava rb.name, mas recipes_bom não
-- possui coluna name (o nome do produto vem do material acabado). O loop de entrada
-- de produto acabado quebraria com "column rb.name does not exist". Buscamos o nome
-- em materials.name via finished_material_id.
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

  -- Consome ingredientes (conforme BOM)
  PERFORM public.consume_materials_for_production(p_production_order_id);

  -- Entrada dos produtos acabados (rendimento real) no estoque
  FOR v_row IN
    SELECT poi.bom_id, poi.total_yield_quantity, poi.actual_yield_quantity, poi.yield_unit,
           rb.finished_material_id, m.name AS bom_name
    FROM public.bom_production_order_items poi
    JOIN public.recipes_bom rb ON rb.id = poi.bom_id
    JOIN public.materials m ON m.id = rb.finished_material_id
    WHERE poi.production_order_id = p_production_order_id
  LOOP
    v_actual_qty := COALESCE(v_row.actual_yield_quantity, v_row.total_yield_quantity);
    PERFORM public.process_finish_input(v_row.finished_material_id, v_actual_qty, 'PRODUCTION_INPUT');
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

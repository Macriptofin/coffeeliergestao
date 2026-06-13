-- =============================================================================
-- FINALIZAÇÃO DE ORDEM DE PRODUÇÃO — Tarefas #63 + #67
-- Data: 2026-06-13
--
-- Adiciona suporte a:
--   - Registro do rendimento real por produto na finalização
--   - Registro de perdas e desperdícios de ingredientes
--   - Função finalize_production_order que substitui o caminho de conclusão
--     do update_production_order_status
-- =============================================================================

-- 1. Colunas de rendimento real nos itens da ordem
ALTER TABLE public.bom_production_order_items
  ADD COLUMN IF NOT EXISTS actual_yield_quantity numeric(14,6),
  ADD COLUMN IF NOT EXISTS yield_notes text;

-- 2. Tabela de perdas e desperdícios
CREATE TABLE IF NOT EXISTS public.bom_production_losses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.bom_production_orders(id) ON DELETE CASCADE,
  material_id         uuid NOT NULL REFERENCES public.materials(id),
  loss_quantity       numeric(14,6) NOT NULL CHECK (loss_quantity > 0),
  loss_unit           text NOT NULL,
  loss_reason         text CHECK (loss_reason IN ('quebra', 'deterioração', 'processo', 'acidente', 'outro')),
  notes               text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_production_losses_order
  ON public.bom_production_losses(production_order_id);

ALTER TABLE public.bom_production_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_managers_manage_losses"
  ON public.bom_production_losses FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- 3. Função principal de finalização
--    p_items  : [{ "bom_item_id": uuid, "actual_yield_quantity": numeric, "notes": text }]
--    p_losses : [{ "material_id": uuid, "loss_quantity": numeric, "loss_unit": text,
--                  "loss_reason": text, "notes": text }]
CREATE OR REPLACE FUNCTION public.finalize_production_order(
  p_production_order_id uuid,
  p_items               jsonb DEFAULT '[]',
  p_losses              jsonb DEFAULT '[]'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_elem        jsonb;
  v_row         record;
  v_actual_qty  numeric;
BEGIN
  -- Valida status
  SELECT status INTO v_status
  FROM public.bom_production_orders
  WHERE id = p_production_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada: %', p_production_order_id;
  END IF;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION 'A ordem precisa estar Em Produção para ser finalizada (status atual: %)', v_status;
  END IF;

  -- 1. Atualizar rendimentos reais em cada item
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    UPDATE public.bom_production_order_items
    SET
      actual_yield_quantity = (v_elem->>'actual_yield_quantity')::numeric,
      yield_notes           = v_elem->>'notes'
    WHERE id                  = (v_elem->>'bom_item_id')::uuid
      AND production_order_id = p_production_order_id;
  END LOOP;

  -- 2. Registrar perdas
  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_losses) LOOP
    INSERT INTO public.bom_production_losses (
      production_order_id, material_id, loss_quantity, loss_unit, loss_reason, notes, created_by
    ) VALUES (
      p_production_order_id,
      (v_elem->>'material_id')::uuid,
      (v_elem->>'loss_quantity')::numeric,
      v_elem->>'loss_unit',
      v_elem->>'loss_reason',
      v_elem->>'notes',
      auth.uid()
    );
  END LOOP;

  -- 3. Consumir materiais (quantidades planejadas do consolidado)
  PERFORM public.consume_materials_for_production(p_production_order_id);

  -- 4. Entrada de produtos acabados usando rendimento REAL (ou planejado como fallback)
  FOR v_row IN
    SELECT
      poi.id,
      poi.bom_id,
      poi.total_yield_quantity,
      poi.actual_yield_quantity,
      poi.yield_unit,
      rb.finished_material_id,
      rb.name AS bom_name
    FROM public.bom_production_order_items poi
    JOIN public.recipes_bom rb ON rb.id = poi.bom_id
    WHERE poi.production_order_id = p_production_order_id
  LOOP
    v_actual_qty := COALESCE(v_row.actual_yield_quantity, v_row.total_yield_quantity);

    -- Entrada no estoque
    PERFORM public.process_finish_input(
      v_row.finished_material_id,
      v_actual_qty,
      'PRODUCTION_INPUT'
    );

    -- Movimento de produção
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id,
      v_row.finished_material_id,
      'produce',
      v_actual_qty,
      v_row.yield_unit,
      format('Produção de %s — rendimento real: %s %s (planejado: %s)',
             v_row.bom_name, v_actual_qty, v_row.yield_unit, v_row.total_yield_quantity),
      auth.uid()
    );
  END LOOP;

  -- 5. Finalizar a ordem
  UPDATE public.bom_production_orders
  SET status = 'completed', completed_at = now()
  WHERE id = p_production_order_id;
END;
$$;

-- Revalorização de custo (ajuste de valor via inventário).
-- Problema: existiam DUAS sobrecargas de process_cost_adjustment (8 e 9 args com
-- p_cycle_id DEFAULT NULL). O frontend chama com 8 args nomeados → o Postgres não
-- conseguia escolher ("Could not choose the best candidate function"). Além disso:
--   * a de 8 args gravava na tabela ERRADA (inventory_adjustments = ajuste de QUANTIDADE)
--     e não registrava movimentação;
--   * a de 9 args mirava a tabela certa (cost_adjustments) + movimentação, porém estava
--     QUEBRADA (referenciava colunas inexistentes: reason_code, responsible_person,
--     occurred_at, adjustment_type, cycle_id).
-- Solução (causa raiz): paridade de colunas em cost_adjustments + UMA única função
-- correta que grava em cost_adjustments, atualiza o custo em stock_items e registra
-- stock_movements de auditoria ('Ajuste de Custo'), como no ajuste de quantidade (#100).

-- 1) Paridade com inventory_adjustments (preserva reason_code/responsible_person enviados pelo front)
ALTER TABLE public.cost_adjustments
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS responsible_person text;

-- 2) Remover as duas sobrecargas conflitantes
DROP FUNCTION IF EXISTS public.process_cost_adjustment(uuid, numeric, text, text, text, text, text, date);
DROP FUNCTION IF EXISTS public.process_cost_adjustment(uuid, numeric, text, text, text, text, text, date, uuid);

-- 3) Função única e correta
CREATE OR REPLACE FUNCTION public.process_cost_adjustment(
  p_material_id        uuid,
  p_new_unit_cost      numeric,
  p_adjustment_reason  text,
  p_reference_document text DEFAULT NULL,
  p_notes              text DEFAULT NULL,
  p_reason_code        text DEFAULT NULL,
  p_responsible_person text DEFAULT NULL,
  p_occurred_at        date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_cost      NUMERIC;
  v_current_qty   NUMERIC;
  v_old_total     NUMERIC;
  v_new_total     NUMERIC;
  v_date          DATE;
  v_adjustment_id UUID;
BEGIN
  v_date := COALESCE(p_occurred_at, CURRENT_DATE);

  SELECT COALESCE(average_price, 0),
         COALESCE(current_quantity, 0),
         COALESCE(total_value, 0)
    INTO v_old_cost, v_current_qty, v_old_total
    FROM public.stock_items
   WHERE material_id = p_material_id;

  v_new_total := p_new_unit_cost * v_current_qty;

  -- Auditoria na tabela DEDICADA de revalorização de custo
  INSERT INTO public.cost_adjustments (
    material_id, adjustment_date, adjustment_time,
    old_unit_cost, new_unit_cost, cost_difference,
    current_quantity, old_total_value, new_total_value,
    adjustment_reason, reference_document,
    responsible_user_id, responsible_person, reason_code, notes
  ) VALUES (
    p_material_id, v_date, CURRENT_TIME,
    v_old_cost, p_new_unit_cost, p_new_unit_cost - v_old_cost,
    v_current_qty, v_old_total, v_new_total,
    p_adjustment_reason, p_reference_document,
    auth.uid(), p_responsible_person, p_reason_code, p_notes
  ) RETURNING id INTO v_adjustment_id;

  -- Define o novo custo (preço médio) e revaloriza o saldo
  UPDATE public.stock_items
     SET average_price = p_new_unit_cost,
         total_value   = v_new_total,
         updated_at    = now()
   WHERE material_id = p_material_id;

  -- Movimentação de auditoria (qty 0): trg_sync_stock_quantity pula 'Ajuste' e o
  -- trigger de média ponderada só age em entradas com unit_price — não interfere.
  INSERT INTO public.stock_movements (
    material_id, movement_type, quantity,
    reference_type, reference_id, notes, responsible_person
  ) VALUES (
    p_material_id, 'Ajuste', 0,
    'Ajuste de Custo', v_adjustment_id,
    'Revalorização de custo: R$' || v_old_cost::text || ' → R$' || p_new_unit_cost::text
      || ' (' || p_adjustment_reason || ')',
    p_responsible_person
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_cost_adjustment(uuid, numeric, text, text, text, text, text, date) TO authenticated;

-- #100 (de fato): o ajuste de inventário (avulso / contagem) passa a registrar uma
-- movimentação no histórico (stock_movements 'Ajuste' / 'Ajuste de Inventário').
-- O trigger trg_sync_stock_quantity faz RETURN NEW para 'Ajuste' (não recalcula saldo),
-- então a quantidade continua sendo definida diretamente em stock_items por esta função.
-- Triggers de média ponderada e validação de produção ignoram 'Ajuste'. CHECKs permitem ambos.
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
  p_material_id uuid,
  p_physical_quantity numeric,
  p_adjustment_reason text,
  p_reference_document text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_reason_code text DEFAULT NULL::text,
  p_responsible_person text DEFAULT NULL::text,
  p_occurred_at date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_system_quantity NUMERIC;
  v_avg_price       NUMERIC;
  v_adjustment_id   UUID;
  v_date            DATE;
  v_diff            NUMERIC;
BEGIN
  v_date := COALESCE(p_occurred_at, CURRENT_DATE);

  SELECT COALESCE(current_quantity, 0), COALESCE(average_price, 0)
    INTO v_system_quantity, v_avg_price
    FROM public.stock_items
   WHERE material_id = p_material_id;

  IF NOT FOUND THEN
    INSERT INTO public.stock_items (material_id, current_quantity, minimum_quantity)
    VALUES (p_material_id, 0, 0);
    v_system_quantity := 0;
    v_avg_price       := 0;
  END IF;

  v_diff := p_physical_quantity - v_system_quantity;

  INSERT INTO public.inventory_adjustments (
    material_id, adjustment_date, adjustment_time,
    system_quantity, physical_quantity,
    adjustment_reason, reference_document,
    responsible_user_id, responsible_person,
    reason_code, notes, is_draft
  ) VALUES (
    p_material_id, v_date, CURRENT_TIME,
    v_system_quantity, p_physical_quantity,
    p_adjustment_reason, p_reference_document,
    auth.uid(), p_responsible_person,
    p_reason_code, p_notes, false
  ) RETURNING id INTO v_adjustment_id;

  -- Saldo definido diretamente (trigger pula 'Ajuste')
  UPDATE public.stock_items
     SET current_quantity   = p_physical_quantity,
         total_value        = p_physical_quantity * v_avg_price,
         last_movement_date = now(),
         updated_at         = now()
   WHERE material_id = p_material_id;

  -- Histórico rastreável da movimentação de ajuste (apenas se houve diferença)
  IF v_diff <> 0 THEN
    INSERT INTO public.stock_movements (
      material_id, movement_type, quantity, unit_price,
      reference_type, reference_id, notes, movement_date
    ) VALUES (
      p_material_id, 'Ajuste', ABS(v_diff), NULL,
      'Ajuste de Inventário', v_adjustment_id,
      (CASE WHEN v_diff > 0 THEN 'Ajuste Positivo: ' ELSE 'Ajuste Negativo: ' END) || p_adjustment_reason,
      v_date
    );
  END IF;

  RETURN v_adjustment_id;
END;
$function$;

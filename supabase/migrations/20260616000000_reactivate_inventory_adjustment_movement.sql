-- ============================================================
-- Task #100: Reativar registro de movimentação em ajustes de inventário
-- ============================================================

-- 1. Atualizar trigger para não recalcular estoque em movimentos tipo 'Ajuste'.
--    process_inventory_adjustment já faz UPDATE direto com a quantidade exata;
--    se o trigger recalculasse, sobrescreveria o ajuste com o saldo histórico.
CREATE OR REPLACE FUNCTION public.trigger_sync_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty NUMERIC;
BEGIN
  -- Movimentos de Ajuste: quantidade já definida diretamente em stock_items.
  -- Apenas registramos o histórico sem recalcular.
  IF NEW.movement_type = 'Ajuste' THEN
    RETURN NEW;
  END IF;

  -- Para demais movimentos, recalcular a partir de todas as movimentações
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução')
      THEN quantity
      WHEN movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda')
      THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_current_qty
  FROM stock_movements
  WHERE material_id = NEW.material_id;

  INSERT INTO stock_items (
    material_id,
    current_quantity,
    average_price,
    total_value,
    last_movement_date,
    updated_at
  ) VALUES (
    NEW.material_id,
    v_current_qty,
    COALESCE(NEW.unit_price, 0),
    v_current_qty * COALESCE(NEW.unit_price, 0),
    NEW.movement_date,
    now()
  )
  ON CONFLICT (material_id) DO UPDATE SET
    current_quantity   = v_current_qty,
    total_value        = CASE
                           WHEN stock_items.average_price > 0
                           THEN v_current_qty * stock_items.average_price
                           ELSE stock_items.total_value
                         END,
    last_movement_date = NEW.movement_date,
    updated_at         = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Migrar dados residuais com reference_type em inglês (segurança)
UPDATE public.stock_movements
   SET reference_type = 'Ajuste de Inventário'
 WHERE reference_type = 'inventory_adjustment';

UPDATE public.stock_movements
   SET reference_type = 'Ajuste de Custo'
 WHERE reference_type = 'cost_adjustment';

UPDATE public.stock_movements
   SET reference_type = 'Ciclo de Inventário'
 WHERE reference_type = 'inventory_cycle';

-- 3. Atualizar process_inventory_adjustment:
--    - reference_type português ('Ajuste de Inventário')
--    - INSERT em stock_movements reativado (o trigger agora faz RETURN NEW para 'Ajuste')
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
  p_material_id        UUID,
  p_physical_quantity  NUMERIC,
  p_adjustment_reason  TEXT,
  p_reference_document TEXT    DEFAULT NULL,
  p_notes              TEXT    DEFAULT NULL,
  p_reason_code        TEXT    DEFAULT NULL,
  p_responsible_person TEXT    DEFAULT NULL,
  p_occurred_at        DATE    DEFAULT NULL,
  p_cycle_id           UUID    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_quantity NUMERIC;
  v_adjustment_id   UUID;
  v_quantity_diff   NUMERIC;
  v_adj_type        TEXT;
BEGIN
  v_adj_type := CASE WHEN p_cycle_id IS NOT NULL THEN 'cycle' ELSE 'avulso' END;

  -- Saldo atual
  SELECT COALESCE(current_quantity, 0)
    INTO v_system_quantity
    FROM public.stock_items
   WHERE material_id = p_material_id;

  IF v_system_quantity IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, minimum_quantity)
    VALUES (p_material_id, 0, 0);
    v_system_quantity := 0;
  END IF;

  v_quantity_diff := p_physical_quantity - v_system_quantity;

  -- Registro do ajuste
  INSERT INTO public.inventory_adjustments (
    material_id, system_quantity, physical_quantity, quantity_difference,
    adjustment_reason, reference_document, responsible_user_id, notes,
    is_draft, reason_code, responsible_person, occurred_at, adjustment_type, cycle_id
  ) VALUES (
    p_material_id, v_system_quantity, p_physical_quantity, v_quantity_diff,
    p_adjustment_reason, p_reference_document, auth.uid(), p_notes,
    false,
    p_reason_code, p_responsible_person,
    COALESCE(p_occurred_at, CURRENT_DATE),
    v_adj_type, p_cycle_id
  ) RETURNING id INTO v_adjustment_id;

  IF v_quantity_diff != 0 THEN
    -- Atualizar estoque diretamente (quantidade exata)
    UPDATE public.stock_items
       SET current_quantity   = p_physical_quantity,
           last_movement_date = now(),
           updated_at         = now()
     WHERE material_id = p_material_id;

    -- Registrar histórico (trigger faz RETURN NEW para 'Ajuste', não recalcula)
    INSERT INTO public.stock_movements (
      material_id, movement_type, quantity,
      reference_type, reference_id, notes, responsible_person
    ) VALUES (
      p_material_id, 'Ajuste', ABS(v_quantity_diff),
      'Ajuste de Inventário', v_adjustment_id,
      CASE
        WHEN v_quantity_diff > 0 THEN 'Ajuste Positivo: ' || p_adjustment_reason
        ELSE 'Ajuste Negativo: ' || p_adjustment_reason
      END,
      p_responsible_person
    );
  END IF;

  RETURN v_adjustment_id;
END;
$$;

-- 4. Atualizar process_cost_adjustment com reference_type português
CREATE OR REPLACE FUNCTION public.process_cost_adjustment(
  p_material_id        UUID,
  p_new_unit_cost      NUMERIC,
  p_adjustment_reason  TEXT,
  p_reference_document TEXT    DEFAULT NULL,
  p_notes              TEXT    DEFAULT NULL,
  p_reason_code        TEXT    DEFAULT NULL,
  p_responsible_person TEXT    DEFAULT NULL,
  p_occurred_at        DATE    DEFAULT NULL,
  p_cycle_id           UUID    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_unit_cost   NUMERIC;
  v_current_qty     NUMERIC;
  v_old_total_value NUMERIC;
  v_new_total_value NUMERIC;
  v_adjustment_id   UUID;
  v_adj_type        TEXT;
BEGIN
  v_adj_type := CASE WHEN p_cycle_id IS NOT NULL THEN 'cycle' ELSE 'avulso' END;

  SELECT COALESCE(average_price, 0), COALESCE(current_quantity, 0),
         COALESCE(total_value, 0)
    INTO v_old_unit_cost, v_current_qty, v_old_total_value
    FROM public.stock_items
   WHERE material_id = p_material_id;

  v_new_total_value := p_new_unit_cost * v_current_qty;

  INSERT INTO public.cost_adjustments (
    material_id, old_unit_cost, new_unit_cost, cost_difference,
    current_quantity, old_total_value, new_total_value,
    adjustment_reason, reference_document, responsible_user_id, notes,
    reason_code, responsible_person, occurred_at, adjustment_type, cycle_id
  ) VALUES (
    p_material_id, v_old_unit_cost, p_new_unit_cost,
    p_new_unit_cost - v_old_unit_cost,
    v_current_qty, v_old_total_value, v_new_total_value,
    p_adjustment_reason, p_reference_document, auth.uid(), p_notes,
    p_reason_code, p_responsible_person,
    COALESCE(p_occurred_at, CURRENT_DATE),
    v_adj_type, p_cycle_id
  ) RETURNING id INTO v_adjustment_id;

  -- Atualizar preço médio e valor total
  UPDATE public.stock_items
     SET average_price = p_new_unit_cost,
         total_value   = v_new_total_value,
         updated_at    = now()
   WHERE material_id = p_material_id;

  -- Registrar histórico de revalorização (quantity=0, apenas auditoria)
  INSERT INTO public.stock_movements (
    material_id, movement_type, quantity,
    reference_type, reference_id, notes, responsible_person
  ) VALUES (
    p_material_id, 'Ajuste', 0,
    'Ajuste de Custo', v_adjustment_id,
    'Revalorização de custo: ' || p_adjustment_reason,
    p_responsible_person
  );

  RETURN v_adjustment_id;
END;
$$;

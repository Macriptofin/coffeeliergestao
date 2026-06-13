-- ============================================================
-- Inventário: campos de auditoria + RPCs atualizados
-- ============================================================

-- 1. inventory_adjustments: novos campos de rastreabilidade
ALTER TABLE public.inventory_adjustments
  ADD COLUMN IF NOT EXISTS reason_code       TEXT,
  ADD COLUMN IF NOT EXISTS responsible_person TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at        DATE,
  ADD COLUMN IF NOT EXISTS adjustment_type    TEXT DEFAULT 'avulso';

-- 2. cost_adjustments: mesmos campos
ALTER TABLE public.cost_adjustments
  ADD COLUMN IF NOT EXISTS reason_code        TEXT,
  ADD COLUMN IF NOT EXISTS responsible_person TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at        DATE,
  ADD COLUMN IF NOT EXISTS adjustment_type    TEXT DEFAULT 'avulso';

-- 3. inventory_cycles: escopo + revisão de custo
ALTER TABLE public.inventory_cycles
  ADD COLUMN IF NOT EXISTS scope               TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS includes_cost_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_by_name       TEXT;

-- 4. stock_movements: responsável
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS responsible_person TEXT;

-- ============================================================
-- 5. Atualizar RPC process_inventory_adjustment
--    Novos parâmetros opcionais: reason_code, responsible_person, occurred_at
-- ============================================================
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

  -- Atualizar estoque e gerar movimento
  IF v_quantity_diff != 0 THEN
    UPDATE public.stock_items
       SET current_quantity   = p_physical_quantity,
           last_movement_date = now(),
           updated_at         = now()
     WHERE material_id = p_material_id;

    INSERT INTO public.stock_movements (
      material_id, movement_type, quantity,
      reference_type, reference_id, notes, responsible_person
    ) VALUES (
      p_material_id, 'Ajuste', ABS(v_quantity_diff),
      'inventory_adjustment', v_adjustment_id,
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

-- ============================================================
-- 6. Atualizar RPC process_cost_adjustment
-- ============================================================
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

  -- Valores atuais
  SELECT COALESCE(average_price, 0), COALESCE(current_quantity, 0),
         COALESCE(total_value, 0)
    INTO v_old_unit_cost, v_current_qty, v_old_total_value
    FROM public.stock_items
   WHERE material_id = p_material_id;

  v_new_total_value := p_new_unit_cost * v_current_qty;

  -- Registro
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

  -- Atualizar average_price e total_value
  UPDATE public.stock_items
     SET average_price = p_new_unit_cost,
         total_value   = v_new_total_value,
         updated_at    = now()
   WHERE material_id = p_material_id;

  -- Movimento de revalorização
  INSERT INTO public.stock_movements (
    material_id, movement_type, quantity,
    reference_type, reference_id, notes, responsible_person
  ) VALUES (
    p_material_id, 'Ajuste', 0,
    'cost_adjustment', v_adjustment_id,
    'Revalorização de custo: ' || p_adjustment_reason,
    p_responsible_person
  );

  RETURN v_adjustment_id;
END;
$$;

-- ============================================================
-- 7. Verificar se cost_adjustments tem cycle_id (adiciona se não tiver)
-- ============================================================
ALTER TABLE public.cost_adjustments
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.inventory_cycles(id) ON DELETE SET NULL;

-- Garantir cycle_id em inventory_adjustments também (pode já existir)
ALTER TABLE public.inventory_adjustments
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.inventory_cycles(id) ON DELETE SET NULL;

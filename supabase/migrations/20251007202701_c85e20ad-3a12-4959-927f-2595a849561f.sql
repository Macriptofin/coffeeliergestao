-- Criar tipo cost_source_type se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_source_type') THEN
    CREATE TYPE cost_source_type AS ENUM ('purchase', 'production', 'manual');
  END IF;
END $$;

-- Adicionar colunas se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_items' AND column_name = 'cost_source') THEN
    ALTER TABLE public.stock_items ADD COLUMN cost_source cost_source_type DEFAULT 'purchase';
    COMMENT ON COLUMN public.stock_items.cost_source IS 'Origem do custo: purchase (compra/NF), production (ordem produção), manual (ajuste manual)';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_items' AND column_name = 'manual_price') THEN
    ALTER TABLE public.stock_items ADD COLUMN manual_price boolean DEFAULT false;
    COMMENT ON COLUMN public.stock_items.manual_price IS 'Se true, permite alteração manual do average_price';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_items' AND column_name = 'cost_last_updated_at') THEN
    ALTER TABLE public.stock_items ADD COLUMN cost_last_updated_at timestamp with time zone DEFAULT now();
    COMMENT ON COLUMN public.stock_items.cost_last_updated_at IS 'Última atualização do custo';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_items' AND column_name = 'cost_last_updated_by') THEN
    ALTER TABLE public.stock_items ADD COLUMN cost_last_updated_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN public.stock_items.cost_last_updated_by IS 'Usuário que atualizou o custo';
  END IF;
END $$;

-- Atualizar funções conforme especificação
CREATE OR REPLACE FUNCTION public.process_stock_entry_with_conversion(
  p_material_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_entry_unit text,
  p_invoice_number text DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_qty_in_usage_unit numeric;
  v_price_in_usage_unit numeric;
  v_current_stock numeric;
  v_current_avg_price numeric;
  v_new_total_qty numeric;
  v_new_avg_price numeric;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  SELECT id, name, purchase_unit, usage_unit, conversion_factor, material_type
  INTO v_material FROM public.materials WHERE id = p_material_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material não encontrado');
  END IF;

  IF p_entry_unit NOT IN (v_material.purchase_unit, v_material.usage_unit) THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Unidade %s inválida. Use %s ou %s', p_entry_unit, v_material.purchase_unit, v_material.usage_unit));
  END IF;

  IF p_entry_unit = v_material.purchase_unit THEN
    v_qty_in_usage_unit := p_quantity * v_material.conversion_factor;
    v_price_in_usage_unit := p_unit_price / v_material.conversion_factor;
  ELSE
    v_qty_in_usage_unit := p_quantity;
    v_price_in_usage_unit := p_unit_price;
  END IF;

  SELECT current_quantity, average_price INTO v_current_stock, v_current_avg_price
  FROM public.stock_items WHERE material_id = p_material_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.stock_items (
      material_id, current_quantity, average_price, total_value, cost_source, manual_price
    ) VALUES (
      p_material_id, v_qty_in_usage_unit, v_price_in_usage_unit,
      v_qty_in_usage_unit * v_price_in_usage_unit, 'purchase', false
    );
    v_new_total_qty := v_qty_in_usage_unit;
    v_new_avg_price := v_price_in_usage_unit;
  ELSE
    v_new_total_qty := v_current_stock + v_qty_in_usage_unit;
    v_new_avg_price := ((v_current_stock * v_current_avg_price) + (v_qty_in_usage_unit * v_price_in_usage_unit)) / v_new_total_qty;

    UPDATE public.stock_items
    SET current_quantity = v_new_total_qty, average_price = v_new_avg_price,
        total_value = v_new_total_qty * v_new_avg_price, last_movement_date = now(), updated_at = now(),
        cost_source = 'purchase', cost_last_updated_at = now(), cost_last_updated_by = auth.uid()
    WHERE material_id = p_material_id;
  END IF;

  INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
  VALUES (p_material_id, 'Entrada', v_qty_in_usage_unit, v_price_in_usage_unit, 'purchase_invoice', p_supplier_id, 
    format('NF: %s | %s', COALESCE(p_invoice_number, 'N/A'), COALESCE(p_notes, '')))
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true, 'material_id', p_material_id, 'material_name', v_material.name,
    'new_avg_price', v_new_avg_price, 'cost_source', 'purchase', 'movement_id', v_movement_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.produce_finished_product(p_material_id uuid, p_quantity numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_material RECORD; v_bom RECORD; v_bom_item RECORD; v_required_qty numeric; v_available_qty numeric;
  v_total_cost numeric := 0; v_unit_cost numeric; v_result jsonb;
BEGIN
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id AND material_type IN ('finished_product', 'intermediate_product');
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Material inválido'); END IF;

  SELECT * INTO v_bom FROM public.recipes_bom WHERE finished_material_id = p_material_id AND is_archived = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada'); END IF;

  FOR v_bom_item IN SELECT rbi.*, m.name FROM public.recipe_bom_items rbi JOIN public.materials m ON m.id = rbi.material_id WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    SELECT current_quantity INTO v_available_qty FROM public.stock_items WHERE material_id = v_bom_item.material_id;
    IF v_available_qty IS NULL OR v_available_qty < v_required_qty THEN
      RETURN jsonb_build_object('success', false, 'error', format('Estoque insuficiente: %s', v_bom_item.name));
    END IF;
  END LOOP;

  FOR v_bom_item IN SELECT rbi.*, si.average_price FROM public.recipe_bom_items rbi 
    JOIN public.stock_items si ON si.material_id = rbi.material_id WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    UPDATE public.stock_items SET current_quantity = current_quantity - v_required_qty, 
      total_value = (current_quantity - v_required_qty) * average_price, last_movement_date = now(), updated_at = now()
    WHERE material_id = v_bom_item.material_id;

    INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id)
    VALUES (v_bom_item.material_id, 'Consumo Produção', v_required_qty, v_bom_item.average_price, 'production', v_bom.id);

    v_total_cost := v_total_cost + (v_required_qty * v_bom_item.average_price);
  END LOOP;

  v_unit_cost := v_total_cost / (v_bom.yield_quantity * p_quantity);

  INSERT INTO public.stock_items (material_id, current_quantity, average_price, total_value, cost_source, manual_price, cost_last_updated_at, cost_last_updated_by)
  VALUES (p_material_id, v_bom.yield_quantity * p_quantity, v_unit_cost, v_total_cost, 'production', false, now(), auth.uid())
  ON CONFLICT (material_id) DO UPDATE SET 
    current_quantity = stock_items.current_quantity + EXCLUDED.current_quantity,
    average_price = EXCLUDED.average_price, total_value = (stock_items.current_quantity + EXCLUDED.current_quantity) * EXCLUDED.average_price,
    cost_source = 'production', cost_last_updated_at = now(), cost_last_updated_by = auth.uid(), last_movement_date = now(), updated_at = now();

  INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id)
  VALUES (p_material_id, 'Entrada Produção', v_bom.yield_quantity * p_quantity, v_unit_cost, 'production', v_bom.id);

  RETURN jsonb_build_object('success', true, 'unit_cost', v_unit_cost, 'cost_source', 'production');
END;
$$;

CREATE OR REPLACE FUNCTION public.assemble_composite(p_material_id uuid, p_quantity numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_material RECORD; v_bom RECORD; v_bom_item RECORD; v_required_qty numeric; v_available_qty numeric; v_total_cost numeric := 0;
BEGIN
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id AND material_type = 'composite_product';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Material inválido'); END IF;

  SELECT * INTO v_bom FROM public.composites_bom WHERE composite_material_id = p_material_id AND is_archived = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada'); END IF;

  FOR v_bom_item IN SELECT cbi.*, m.name FROM public.composite_bom_items cbi JOIN public.materials m ON m.id = cbi.component_material_id WHERE cbi.composite_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    SELECT current_quantity INTO v_available_qty FROM public.stock_items WHERE material_id = v_bom_item.component_material_id;
    IF v_available_qty IS NULL OR v_available_qty < v_required_qty THEN RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente'); END IF;
  END LOOP;

  FOR v_bom_item IN SELECT cbi.*, si.average_price FROM public.composite_bom_items cbi 
    JOIN public.stock_items si ON si.material_id = cbi.component_material_id WHERE cbi.composite_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;
    UPDATE public.stock_items SET current_quantity = current_quantity - v_required_qty, 
      total_value = (current_quantity - v_required_qty) * average_price, last_movement_date = now()
    WHERE material_id = v_bom_item.component_material_id;

    INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id)
    VALUES (v_bom_item.component_material_id, 'Consumo Montagem', v_required_qty, v_bom_item.average_price, 'assembly', v_bom.id);

    v_total_cost := v_total_cost + (v_required_qty * v_bom_item.average_price);
  END LOOP;

  INSERT INTO public.stock_items (material_id, current_quantity, average_price, total_value, cost_source, cost_last_updated_at, cost_last_updated_by)
  VALUES (p_material_id, p_quantity, v_total_cost / p_quantity, v_total_cost, 'production', now(), auth.uid())
  ON CONFLICT (material_id) DO UPDATE SET current_quantity = stock_items.current_quantity + EXCLUDED.current_quantity,
    average_price = EXCLUDED.average_price, total_value = (stock_items.current_quantity + EXCLUDED.current_quantity) * EXCLUDED.average_price,
    cost_source = 'production', cost_last_updated_at = now(), cost_last_updated_by = auth.uid();

  INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id)
  VALUES (p_material_id, 'Entrada Montagem', p_quantity, v_total_cost / p_quantity, 'assembly', v_bom.id);

  RETURN jsonb_build_object('success', true, 'unit_cost', v_total_cost / p_quantity, 'cost_source', 'production');
END;
$$;
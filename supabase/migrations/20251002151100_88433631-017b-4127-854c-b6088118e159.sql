-- Remover todas as versões da função calculate_bom_current_cost
DROP FUNCTION IF EXISTS public.calculate_bom_current_cost CASCADE;

-- Criar funções core
CREATE OR REPLACE FUNCTION public.validate_material_units(p_material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_issues jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'issues', jsonb_build_array('Material não encontrado'));
  END IF;
  IF v_material.purchase_unit IS NULL OR v_material.purchase_unit = '' THEN
    v_issues := v_issues || jsonb_build_array('purchase_unit não pode ser nulo');
  END IF;
  IF v_material.usage_unit IS NULL OR v_material.usage_unit = '' THEN
    v_issues := v_issues || jsonb_build_array('usage_unit não pode ser nulo');
  END IF;
  IF v_material.conversion_factor IS NULL OR v_material.conversion_factor <= 0 THEN
    v_issues := v_issues || jsonb_build_array('conversion_factor inválido');
  END IF;
  RETURN jsonb_build_object('valid', jsonb_array_length(v_issues) = 0, 'issues', v_issues, 'material_id', p_material_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_stock_entry_with_conversion(
  p_material_id uuid,
  p_quantity_purchased numeric,
  p_unit_price_purchase numeric,
  p_reference_type text DEFAULT 'purchase',
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_material RECORD; v_stock RECORD; v_validation jsonb;
  v_quantity_in_usage_unit numeric; v_unit_price_in_usage_unit numeric;
  v_current_stock numeric; v_current_avg_price numeric;
  v_new_avg_price numeric; v_new_total_stock numeric; v_movement_id uuid;
BEGIN
  v_validation := public.validate_material_units(p_material_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Config inválida', 'validation', v_validation);
  END IF;
  
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id FOR UPDATE;
  v_quantity_in_usage_unit := p_quantity_purchased * v_material.conversion_factor;
  v_unit_price_in_usage_unit := p_unit_price_purchase / v_material.conversion_factor;
  
  SELECT COALESCE(current_quantity, 0) as current_quantity, COALESCE(average_price, 0) as average_price
  INTO v_stock FROM public.stock_items WHERE material_id = p_material_id FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, total_value)
    VALUES (p_material_id, 0, 0, 0, 0);
    v_stock.current_quantity := 0; v_stock.average_price := 0;
  END IF;
  
  v_current_stock := v_stock.current_quantity;
  v_current_avg_price := v_stock.average_price;
  v_new_total_stock := v_current_stock + v_quantity_in_usage_unit;
  
  IF v_new_total_stock > 0 THEN
    v_new_avg_price := ((v_current_stock * v_current_avg_price) + (v_quantity_in_usage_unit * v_unit_price_in_usage_unit)) / v_new_total_stock;
  ELSE
    v_new_avg_price := v_unit_price_in_usage_unit;
  END IF;
  
  UPDATE public.stock_items
  SET current_quantity = v_new_total_stock, average_price = v_new_avg_price,
      total_value = v_new_total_stock * v_new_avg_price, last_movement_date = now(), updated_at = now()
  WHERE material_id = p_material_id;
  
  INSERT INTO public.stock_movements (material_id, movement_type, quantity, unit_price, reference_type, reference_id, notes)
  VALUES (p_material_id, 'Entrada', v_quantity_in_usage_unit, v_unit_price_in_usage_unit, p_reference_type, p_reference_id,
    COALESCE(p_notes, '') || format(' | Compra: %s %s @ R$%s | Conv: %s %s @ R$%s',
      p_quantity_purchased, v_material.purchase_unit, p_unit_price_purchase,
      ROUND(v_quantity_in_usage_unit, 4), v_material.usage_unit, ROUND(v_unit_price_in_usage_unit, 6)))
  RETURNING id INTO v_movement_id;
  
  RETURN jsonb_build_object('success', true, 'movement_id', v_movement_id,
    'stock_after', jsonb_build_object('quantity', v_new_total_stock, 'average_price', v_new_avg_price));
END;
$$;

CREATE FUNCTION public.calculate_bom_current_cost(p_bom_type text, p_bom_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item RECORD; v_total_cost numeric := 0; v_items jsonb := '[]'::jsonb;
  v_stock RECORD; v_item_cost numeric; v_warnings jsonb := '[]'::jsonb;
BEGIN
  IF p_bom_type = 'recipe' THEN
    FOR v_item IN
      SELECT rbi.material_id, rbi.quantity, rbi.unit, m.name as material_name
      FROM public.recipe_bom_items rbi JOIN public.materials m ON m.id = rbi.material_id
      WHERE rbi.recipe_id = p_bom_id
    LOOP
      SELECT COALESCE(average_price, 0) as average_price INTO v_stock
      FROM public.stock_items WHERE material_id = v_item.material_id;
      
      IF NOT FOUND OR v_stock.average_price = 0 THEN
        v_warnings := v_warnings || jsonb_build_object('material', v_item.material_name, 'issue', 'Sem preço');
        v_stock.average_price := 0;
      END IF;
      
      v_item_cost := v_item.quantity * v_stock.average_price;
      v_total_cost := v_total_cost + v_item_cost;
      v_items := v_items || jsonb_build_object('material', v_item.material_name, 'qty', v_item.quantity, 'price', v_stock.average_price, 'cost', v_item_cost);
    END LOOP;
  ELSIF p_bom_type = 'composite' THEN
    FOR v_item IN
      SELECT cbi.component_material_id as material_id, cbi.quantity, cbi.unit, m.name as material_name
      FROM public.composite_bom_items cbi JOIN public.materials m ON m.id = cbi.component_material_id
      WHERE cbi.composite_id = p_bom_id
    LOOP
      SELECT COALESCE(average_price, 0) as average_price INTO v_stock
      FROM public.stock_items WHERE material_id = v_item.material_id;
      
      IF NOT FOUND OR v_stock.average_price = 0 THEN
        v_warnings := v_warnings || jsonb_build_object('material', v_item.material_name, 'issue', 'Sem preço');
        v_stock.average_price := 0;
      END IF;
      
      v_item_cost := v_item.quantity * v_stock.average_price;
      v_total_cost := v_total_cost + v_item_cost;
      v_items := v_items || jsonb_build_object('material', v_item.material_name, 'qty', v_item.quantity, 'price', v_stock.average_price, 'cost', v_item_cost);
    END LOOP;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'BOM type inválido');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'total_cost', v_total_cost, 'items', v_items, 'warnings', v_warnings);
END;
$$;
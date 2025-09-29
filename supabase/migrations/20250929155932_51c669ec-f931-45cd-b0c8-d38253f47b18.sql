-- Função para calcular o custo real de uma BOM baseado nos preços atuais dos insumos
CREATE OR REPLACE FUNCTION public.calculate_bom_current_cost(p_bom_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_cost NUMERIC := 0;
  v_yield_quantity NUMERIC;
  item_record RECORD;
BEGIN
  -- Buscar rendimento da BOM
  SELECT yield_quantity INTO v_yield_quantity
  FROM public.recipes_bom
  WHERE id = p_bom_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOM não encontrada: %', p_bom_id;
  END IF;
  
  -- Calcular custo total baseado nos preços atuais dos insumos
  FOR item_record IN
    SELECT 
      rbi.quantity,
      rbi.unit,
      -- Usar preço do estoque se disponível, senão usar preço cadastrado
      COALESCE(si.average_price, m.price_per_purchase_unit, 0) as unit_price,
      m.conversion_factor,
      m.name as material_name
    FROM public.recipe_bom_items rbi
    JOIN public.materials m ON m.id = rbi.material_id  
    LEFT JOIN public.stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = p_bom_id
  LOOP
    -- Calcular custo por unidade de uso
    DECLARE
      cost_per_usage_unit NUMERIC;
      ingredient_total_cost NUMERIC;
    BEGIN
      cost_per_usage_unit := item_record.unit_price / item_record.conversion_factor;
      ingredient_total_cost := item_record.quantity * cost_per_usage_unit;
      v_total_cost := v_total_cost + ingredient_total_cost;
      
      -- Log para debug
      INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
      VALUES (
        'BOM_COST_CALCULATION',
        jsonb_build_object(
          'bom_id', p_bom_id,
          'material', item_record.material_name,
          'quantity', item_record.quantity,
          'unit_price', item_record.unit_price,
          'cost_per_usage_unit', cost_per_usage_unit,
          'ingredient_cost', ingredient_total_cost
        ),
        auth.uid()
      );
    END;
  END LOOP;
  
  -- Custo unitário (total / rendimento)
  RETURN CASE 
    WHEN v_yield_quantity > 0 THEN v_total_cost / v_yield_quantity
    ELSE v_total_cost
  END;
END;
$function$;

-- Função corrigida para entrada de produtos acabados com custo calculado
CREATE OR REPLACE FUNCTION public.process_finish_input_with_bom_cost(
  p_material_id uuid, 
  p_quantity numeric, 
  p_movement_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bom_id UUID;
  v_calculated_cost NUMERIC;
  v_current_quantity NUMERIC;
  v_current_avg_price NUMERIC;
  v_new_avg_price NUMERIC;
  v_total_quantity NUMERIC;
BEGIN
  -- Verificar se existe BOM para este material
  SELECT id INTO v_bom_id
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id;
  
  -- Calcular custo baseado na BOM se existir
  IF v_bom_id IS NOT NULL THEN
    v_calculated_cost := public.calculate_bom_current_cost(v_bom_id);
  ELSE
    -- Usar preço cadastrado se não tiver BOM
    SELECT price_per_purchase_unit INTO v_calculated_cost
    FROM public.materials
    WHERE id = p_material_id;
  END IF;
  
  -- Garantir que existe registro de estoque
  INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  VALUES (p_material_id, 0, COALESCE(v_calculated_cost, 0), 0, now())
  ON CONFLICT (material_id) DO NOTHING;
  
  -- Buscar valores atuais do estoque
  SELECT current_quantity, average_price 
  INTO v_current_quantity, v_current_avg_price
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- Calcular nova quantidade e preço médio móvel
  v_total_quantity := v_current_quantity + p_quantity;
  
  IF v_total_quantity > 0 THEN
    v_new_avg_price := (
      (v_current_quantity * COALESCE(v_current_avg_price, 0)) + 
      (p_quantity * v_calculated_cost)
    ) / v_total_quantity;
  ELSE
    v_new_avg_price := v_calculated_cost;
  END IF;
  
  -- Atualizar estoque com preço médio móvel
  UPDATE public.stock_items
  SET 
    current_quantity = v_total_quantity,
    average_price = v_new_avg_price,
    total_value = v_total_quantity * v_new_avg_price,
    last_movement_date = now(),
    updated_at = now()
  WHERE material_id = p_material_id;
  
  -- Registrar movimento
  INSERT INTO public.stock_movements (
    material_id, 
    movement_type, 
    quantity, 
    reference_type, 
    notes, 
    movement_date
  ) VALUES (
    p_material_id, 
    'Entrada', 
    p_quantity, 
    'Producao', 
    format('Entrada por produção - Custo calculado: R$ %.4f', v_calculated_cost), 
    now()
  );
  
  -- Log da operação
  INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
  VALUES (
    'FINISH_INPUT_WITH_BOM_COST',
    jsonb_build_object(
      'material_id', p_material_id,
      'quantity', p_quantity,
      'calculated_cost', v_calculated_cost,
      'old_avg_price', v_current_avg_price,
      'new_avg_price', v_new_avg_price,
      'total_quantity', v_total_quantity
    ),
    auth.uid()
  );
END;
$function$;

-- Atualizar função de produção para usar a nova lógica de custo
CREATE OR REPLACE FUNCTION public.produce_finished_product_with_correct_cost(
  p_finished_material uuid, 
  p_output_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r_rec RECORD;
  req_qty numeric;
  comp RECORD;
BEGIN
  SELECT * INTO r_rec FROM public.recipes_bom WHERE finished_material_id = p_finished_material;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOM não encontrada para material %', p_finished_material;
  END IF;

  -- Consome componentes (inclui embalagens se estiverem na receita)
  FOR comp IN
    SELECT ri.*, m.id AS mat_id
    FROM public.recipe_bom_items ri
    JOIN public.materials m ON m.id = ri.material_id
    WHERE ri.recipe_id = r_rec.id
  LOOP
    req_qty := (p_output_qty / r_rec.yield_quantity) * comp.quantity;
    PERFORM public.process_component_consumption(comp.mat_id, req_qty, comp.unit, 'PRODUCTION_CONSUMPTION', p_finished_material);
  END LOOP;

  -- Entrada do produto acabado com custo correto baseado na BOM
  PERFORM public.process_finish_input_with_bom_cost(p_finished_material, p_output_qty, 'PRODUCTION_INPUT');
END;
$function$;
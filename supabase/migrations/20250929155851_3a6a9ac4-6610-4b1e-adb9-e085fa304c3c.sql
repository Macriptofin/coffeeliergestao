-- Função para calcular o custo real de uma BOM (versão sem logs para consultas)
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
    END;
  END LOOP;
  
  -- Custo unitário (total / rendimento)
  RETURN CASE 
    WHEN v_yield_quantity > 0 THEN v_total_cost / v_yield_quantity
    ELSE v_total_cost
  END;
END;
$function$;
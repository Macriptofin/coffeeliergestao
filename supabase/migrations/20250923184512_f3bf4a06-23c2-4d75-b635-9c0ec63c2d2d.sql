-- Atualizar a função para garantir que last_movement_date seja sempre preenchida
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_price(p_material_id uuid, p_new_quantity numeric, p_new_price numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_stock RECORD;
  new_total_quantity NUMERIC;
  new_total_value NUMERIC;
  new_average_price NUMERIC;
BEGIN
  -- Buscar estoque atual
  SELECT current_quantity, average_price, total_value
  INTO current_stock
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- Se não existe registro de estoque, criar
  IF current_stock IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, average_price, total_value, last_movement_date)
    VALUES (p_material_id, p_new_quantity, p_new_price, p_new_quantity * p_new_price, now());
    RETURN p_new_price;
  END IF;
  
  -- Calcular novo preço médio ponderado
  new_total_quantity := current_stock.current_quantity + p_new_quantity;
  new_total_value := current_stock.total_value + (p_new_quantity * p_new_price);
  
  IF new_total_quantity > 0 THEN
    new_average_price := new_total_value / new_total_quantity;
  ELSE
    new_average_price := 0;
    new_total_value := 0;
  END IF;
  
  -- Atualizar estoque
  UPDATE public.stock_items
  SET 
    current_quantity = new_total_quantity,
    average_price = new_average_price,
    total_value = new_total_value,
    last_movement_date = now(),
    updated_at = now()
  WHERE material_id = p_material_id;
  
  RETURN new_average_price;
END;
$function$;
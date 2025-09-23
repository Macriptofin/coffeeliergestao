-- Correção da função de preço médio ponderado para segurança
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_price(
  p_ingredient_id UUID,
  p_new_quantity NUMERIC,
  p_new_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE ingredient_id = p_ingredient_id;
  
  -- Se não existe registro de estoque, criar
  IF current_stock IS NULL THEN
    INSERT INTO public.stock_items (ingredient_id, current_quantity, average_price, total_value)
    VALUES (p_ingredient_id, p_new_quantity, p_new_price, p_new_quantity * p_new_price);
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
    last_movement_date = now()
  WHERE ingredient_id = p_ingredient_id;
  
  RETURN new_average_price;
END;
$$;
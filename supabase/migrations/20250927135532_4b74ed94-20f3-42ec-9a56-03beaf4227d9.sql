-- Adicionar estoque inicial para os materiais da receita do Café Especial 100ml
UPDATE public.stock_items 
SET current_quantity = 500, 
    average_price = 0.10,
    total_value = 50.00
WHERE material_id IN (
  SELECT material_id 
  FROM recipe_bom_items 
  WHERE recipe_id = '6dc42d04-cbda-468c-86cf-7c2b746dafcd'
);

-- Verificar se existe estoque para o próprio produto acabado
UPDATE public.stock_items 
SET current_quantity = 0, 
    average_price = 2.50,
    total_value = 0
WHERE material_id = '981486f8-6c98-4685-9e8c-c04f4a92a25b'; -- Café Especial 100ml
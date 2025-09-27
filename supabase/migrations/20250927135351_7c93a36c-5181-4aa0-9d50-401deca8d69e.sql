-- Adicionar estoque inicial para os ingredientes da receita do Café Especial para permitir teste
UPDATE public.stock_items 
SET current_quantity = 1000, -- Quantidade suficiente para testes
    average_price = CASE 
      WHEN material_id = 'b0923163-edfb-4117-8b87-077e0ae3011d' THEN 0.10 -- Copo Descartável 100ml
      WHEN material_id = '5b3ac853-b897-4de9-9217-0ae3ada2753b' THEN 0.05 -- Sachê de Açúcar  
      WHEN material_id = '305f29f9-7269-4a6a-bd2c-abdf6983dbc5' THEN 0.02 -- Mexedor de Café
      ELSE average_price
    END
WHERE material_id IN (
  'b0923163-edfb-4117-8b87-077e0ae3011d', -- Copo Descartável 100ml
  '5b3ac853-b897-4de9-9217-0ae3ada2753b', -- Sachê de Açúcar
  '305f29f9-7269-4a6a-bd2c-abdf6983dbc5'  -- Mexedor de Café
);
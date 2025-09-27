-- Criar registros de estoque iniciais para materiais que não têm
INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
SELECT 
  m.id,
  0,
  COALESCE(m.price_per_purchase_unit, 0),
  0,
  now()
FROM public.materials m
LEFT JOIN public.stock_items si ON si.material_id = m.id
WHERE si.id IS NULL;
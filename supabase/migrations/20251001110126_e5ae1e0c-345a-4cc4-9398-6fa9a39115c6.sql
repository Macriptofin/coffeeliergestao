-- Correção temporária: multiplicar preços muito baixos por 1000
-- Isso corrige preços que foram salvos como "por grama" quando deveriam ser "por kg"

UPDATE public.stock_items
SET 
  average_price = average_price * 1000,
  total_value = current_quantity * (average_price * 1000),
  updated_at = now()
WHERE average_price > 0 
  AND average_price < 0.01
  AND EXISTS (
    SELECT 1 FROM public.materials m 
    WHERE m.id = stock_items.material_id 
    AND m.purchase_unit = 'kg'
  );

-- Log dos materiais corrigidos
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Corrigidos % registros de stock_items com preços incorretos', affected_count;
END $$;
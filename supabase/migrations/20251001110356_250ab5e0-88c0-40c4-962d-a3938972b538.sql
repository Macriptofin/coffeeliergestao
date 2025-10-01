-- Reversão da correção automática: dividir preços por 1000
-- Reverte a multiplicação anterior para permitir ajuste manual

UPDATE public.stock_items
SET 
  average_price = average_price / 1000,
  total_value = current_quantity * (average_price / 1000),
  updated_at = now()
WHERE average_price > 0 
  AND average_price <= 10  -- Valores que foram multiplicados (0.01 * 1000 = 10)
  AND EXISTS (
    SELECT 1 FROM public.materials m 
    WHERE m.id = stock_items.material_id 
    AND m.purchase_unit = 'kg'
  );

-- Log dos materiais revertidos
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Revertidos % registros de stock_items', affected_count;
END $$;
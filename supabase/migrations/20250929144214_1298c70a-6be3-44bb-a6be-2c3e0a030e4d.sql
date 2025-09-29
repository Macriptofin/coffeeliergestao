-- Trigger para garantir que o total_value seja sempre calculado corretamente
CREATE OR REPLACE FUNCTION public.calculate_stock_total_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Calcular o valor total sempre que quantidade ou preço médio for alterado
  NEW.total_value = COALESCE(NEW.current_quantity, 0) * COALESCE(NEW.average_price, 0);
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Criar trigger que atualiza o total_value automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_stock_total_value ON public.stock_items;
CREATE TRIGGER trigger_calculate_stock_total_value
  BEFORE INSERT OR UPDATE OF current_quantity, average_price
  ON public.stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_stock_total_value();
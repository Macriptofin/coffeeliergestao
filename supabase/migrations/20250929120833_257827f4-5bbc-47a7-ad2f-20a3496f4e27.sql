-- Remover trigger duplicado se existir
DROP TRIGGER IF EXISTS trigger_update_bom_production_orders_updated_at ON public.bom_production_orders;

-- Criar o trigger novamente
CREATE TRIGGER trigger_update_bom_production_orders_updated_at
  BEFORE UPDATE ON public.bom_production_orders
  FOR EACH ROW EXECUTE FUNCTION update_bom_production_orders_updated_at();
-- Função para recalcular e atualizar o valor total do estoque
CREATE OR REPLACE FUNCTION public.recalculate_stock_total_values()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar o total_value para todos os itens de estoque
  -- onde total_value = quantidade * preço_médio
  UPDATE public.stock_items
  SET 
    total_value = current_quantity * average_price,
    updated_at = now()
  WHERE current_quantity IS NOT NULL 
    AND average_price IS NOT NULL;
    
  -- Log da operação
  INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
  VALUES (
    'RECALCULATE_STOCK_VALUES',
    jsonb_build_object(
      'timestamp', now(),
      'action', 'Updated total_value for all stock items'
    ),
    auth.uid()
  );
END;
$function$;

-- Executar a correção imediatamente para os dados existentes
SELECT public.recalculate_stock_total_values();
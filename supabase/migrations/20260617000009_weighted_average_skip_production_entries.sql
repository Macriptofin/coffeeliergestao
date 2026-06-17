-- FASE 1 (correção de raiz): média ponderada só faz sentido para itens COMPRADOS
-- (custo = preço pago). Produto FABRICADO tem custo-padrão, rolado da ficha técnica
-- via trigger_refresh_bom_costs (cascata). Agora que a entrada de produção carimba
-- unit_price (custo histórico do lote), precisamos impedir que essa entrada dispare
-- o recálculo de média ponderada — senão o custo real do lote sobrescreveria o
-- custo-padrão no average_price. Excluímos entradas com reference_type de produção.
CREATE OR REPLACE FUNCTION public.trigger_update_weighted_average_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só média ponderada em COMPRAS/entradas de aquisição. Entradas de produção
  -- (reference_type 'Ordem de Produção'/'Producao'/'production') NÃO entram: o custo
  -- do acabado é o custo-padrão mantido pela cascata de custo das fichas.
  IF (NEW.movement_type IN ('Entrada', 'Compra', 'Entrada NF')
      AND NEW.unit_price IS NOT NULL
      AND NEW.unit_price > 0
      AND COALESCE(NEW.reference_type, '') NOT IN ('Ordem de Produção', 'Producao', 'production')) THEN

    PERFORM calculate_weighted_average_price(NEW.material_id);

  END IF;

  RETURN NEW;
END;
$function$;

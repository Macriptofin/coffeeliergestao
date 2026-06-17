-- FASE 1b — Aposentar o fluxo paralelo de "produção rápida", quebrado e conflitante.
-- produce_finished_product / assemble_composite inseriam movement_types inválidos
-- ('Entrada Produção', 'Consumo Produção', 'Consumo Montagem', 'Entrada Montagem')
-- que violam o CHECK stock_movements_movement_type_check, e usavam um modelo de
-- custeio (média ponderada por lote) conflitante com o custo-padrão adotado.
-- As variantes _with_correct_cost / _for_order eram órfãs (sem chamada no código).
-- Produção consolidada no fluxo canônico de Ordem de Produção (finalize_production_order).
-- Frontend: componente ProductionExecutor e aba "Executar Produção" de BOMManagement removidos.
DROP FUNCTION IF EXISTS public.produce_finished_product(uuid, numeric);
DROP FUNCTION IF EXISTS public.produce_finished_product_with_correct_cost(uuid, numeric);
DROP FUNCTION IF EXISTS public.produce_finished_products_for_order(uuid);
DROP FUNCTION IF EXISTS public.assemble_composite(uuid, numeric);

-- O trigger de validação ainda sugeria a função aposentada na mensagem de erro.
-- Atualiza o HINT para apontar ao fluxo canônico.
CREATE OR REPLACE FUNCTION public.validate_production_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Normalizar reference_type antigo 'Producao' para 'production'
  IF NEW.reference_type = 'Producao' THEN
    NEW.reference_type := 'production';
  END IF;

  -- Bloquear entradas de produção sem custos (previne inflação de preços)
  IF (
    (NEW.movement_type IN ('Entrada', 'Entrada Produção', 'Entrada Producao')
     AND NEW.reference_type IN ('production', 'Producao'))
    OR
    (NEW.movement_type ILIKE '%produ%')
  ) THEN
    IF NEW.unit_price IS NULL OR NEW.unit_price = 0 THEN
      RAISE EXCEPTION 'Movimentos de produção devem ter unit_price preenchido.'
        USING HINT = 'Finalize a produção pelo fluxo de Ordem de Produção (Produção > Ordens).';
    END IF;

    IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
      RAISE EXCEPTION 'Movimentos de produção devem ter total_cost preenchido.'
        USING HINT = 'Finalize a produção pelo fluxo de Ordem de Produção (Produção > Ordens).';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

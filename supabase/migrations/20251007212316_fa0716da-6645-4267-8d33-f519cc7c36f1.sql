-- Corrigir cost_source de registros existentes baseado no material_type
UPDATE public.stock_items si
SET cost_source = 'production'
FROM public.materials m
WHERE si.material_id = m.id
  AND m.material_type IN ('finished_product', 'intermediate_product', 'composite_product')
  AND si.cost_source = 'purchase';

-- Criar função para visualizar origem de custos atual
CREATE OR REPLACE FUNCTION public.get_cost_source_summary()
RETURNS TABLE (
  material_type text,
  cost_source cost_source_type,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.material_type,
    si.cost_source,
    COUNT(*)
  FROM public.stock_items si
  JOIN public.materials m ON m.id = si.material_id
  GROUP BY m.material_type, si.cost_source
  ORDER BY m.material_type, si.cost_source;
$$;

COMMENT ON FUNCTION public.get_cost_source_summary() IS 'Retorna resumo de origem de custos por tipo de material';
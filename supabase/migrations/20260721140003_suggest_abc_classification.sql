-- Sugestão de classificação ABC por curva de Pareto do valor de consumo real
-- (stock_movements tipo 'Saída' no período). Só considera tipos comprávels
-- (nunca produzido — intermediate_product/finished_product/composite_product
-- não entram em stock_parameters, são produzidos sob demanda). stock_movements
-- de saída não guarda custo próprio (unit_price/total_cost não são preenchidos
-- hoje) — usa o preço médio atual (stock_items.average_price) como proxy, com
-- fallback pro preço de compra cadastrado no material.
CREATE OR REPLACE FUNCTION public.suggest_abc_classification(p_lookback_days integer DEFAULT 180)
RETURNS TABLE(
  material_id uuid,
  material_name text,
  usage_unit text,
  consumption_value numeric,
  cumulative_pct numeric,
  suggested_classification text,
  avg_daily_consumption numeric,
  suggested_reorder_point numeric,
  suggested_maximum_stock numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH consumo AS (
    SELECT
      sm.material_id,
      m.name AS material_name,
      m.usage_unit,
      sum(sm.quantity) AS total_qty,
      sum(sm.quantity * coalesce(si.average_price, m.price_per_purchase_unit, 0)) AS valor_consumo
    FROM public.stock_movements sm
    JOIN public.materials m ON m.id = sm.material_id
    LEFT JOIN public.stock_items si ON si.material_id = sm.material_id
    WHERE sm.movement_type = 'Saída'
      AND sm.movement_date >= now() - (p_lookback_days || ' days')::interval
      AND m.material_type IN ('ingredient','packaging','supply','resale_product','equipment')
      AND m.is_archived = false
    GROUP BY sm.material_id, m.name, m.usage_unit
    HAVING sum(sm.quantity * coalesce(si.average_price, m.price_per_purchase_unit, 0)) > 0
  ),
  total AS (
    SELECT sum(valor_consumo) AS total_value FROM consumo
  ),
  ranked AS (
    SELECT
      c.*,
      sum(c.valor_consumo) OVER (ORDER BY c.valor_consumo DESC ROWS UNBOUNDED PRECEDING) / NULLIF(t.total_value, 0) AS cum_pct
    FROM consumo c, total t
  )
  SELECT
    r.material_id,
    r.material_name,
    r.usage_unit,
    r.valor_consumo,
    round(r.cum_pct * 100, 2),
    CASE WHEN r.cum_pct <= 0.80 THEN 'A' WHEN r.cum_pct <= 0.95 THEN 'B' ELSE 'C' END,
    round(r.total_qty / greatest(p_lookback_days, 1), 4),
    round((r.total_qty / greatest(p_lookback_days, 1)) * 7, 2),
    round((r.total_qty / greatest(p_lookback_days, 1)) * 14, 2)
  FROM ranked r
  ORDER BY r.valor_consumo DESC;
$$;

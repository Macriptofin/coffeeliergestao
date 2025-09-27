-- [Doc] Correção final: Definir explicitamente SECURITY INVOKER na view

-- Recriar a view com SECURITY INVOKER explícito
DROP VIEW IF EXISTS v_finished_product_cost;

CREATE VIEW v_finished_product_cost 
WITH (security_invoker=true) AS
SELECT
  r.finished_material_id AS material_id,
  r.yield_quantity,
  r.yield_unit,
  SUM(
    ri.quantity
    * COALESCE(
        si.average_price / NULLIF(m.conversion_factor, 0),   -- custo por unidade de uso vindo do estoque
        m.price_per_purchase_unit / NULLIF(m.conversion_factor, 0) -- fallback: preço do cadastro
      )
  ) AS standard_cost_per_yield
FROM recipes_bom r
JOIN recipe_bom_items ri ON ri.recipe_id = r.id
JOIN materials m ON m.id = ri.material_id
LEFT JOIN stock_items si ON si.material_id = m.id
GROUP BY r.finished_material_id, r.yield_quantity, r.yield_unit;
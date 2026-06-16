-- Estende o conjunto de material_type (comportamental) para cobrir bens duráveis
-- (equipment) e consumíveis fora de receita (supply: limpeza/operacional).
-- Mudança aditiva: amplia o CHECK, não invalida nenhuma linha existente.
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_material_type_check;
ALTER TABLE materials ADD CONSTRAINT materials_material_type_check
  CHECK (material_type = ANY (ARRAY[
    'ingredient','packaging','intermediate_product','finished_product',
    'composite_product','resale_product','equipment','supply'
  ]::text[]));

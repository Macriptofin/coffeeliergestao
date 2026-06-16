-- Ovo (INS0006) passou a ser medido em 'unidade' (unit_weight = 50g/ovo).
-- As fichas técnicas que ainda tinham o ovo em gramas são convertidas para unidade
-- dividindo a quantidade por 50. Linhas já em 'unidade' não são tocadas.
-- Após a conversão, recalcular o custo das fichas que usam ovo via
-- refresh_bom_costs_for_material('6fa9e008-d72b-46b5-995c-38b972c472e9').
UPDATE recipe_bom_items
SET quantity = round((quantity / 50.0)::numeric, 4),
    unit = 'unidade'
WHERE material_id = '6fa9e008-d72b-46b5-995c-38b972c472e9'
  AND unit = 'g';

SELECT refresh_bom_costs_for_material('6fa9e008-d72b-46b5-995c-38b972c472e9');

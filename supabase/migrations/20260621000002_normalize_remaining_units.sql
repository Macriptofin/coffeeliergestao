-- Padronização de unidades remanescentes (fora dos 254 itens já normalizados na depuração).
UPDATE public.materials
SET usage_unit = CASE WHEN usage_unit IN ('unidade','UN','Un') THEN 'un' ELSE usage_unit END,
    purchase_unit = CASE WHEN purchase_unit IN ('unidade','UN','Un') THEN 'un'
                         WHEN purchase_unit IN ('PCT','pct') THEN 'pacote'
                         ELSE purchase_unit END,
    updated_at = now()
WHERE usage_unit IN ('unidade','UN','Un')
   OR purchase_unit IN ('unidade','UN','Un','PCT','pct');

UPDATE public.recipe_bom_items
SET unit = CASE
  WHEN unit IN ('unidade','UN','Un') THEN 'un'
  WHEN unit IN ('ml','ML') THEN 'mL'
  WHEN unit IN ('gr','GR','grs','Gr') THEN 'g'
  ELSE unit END
WHERE unit IN ('unidade','UN','Un','ml','ML','gr','GR','grs','Gr');

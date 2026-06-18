-- Matriz tipo→comportamento: o TIPO determina a vendabilidade. Produtos de tipo
-- vendável (acabado/composto/revenda) devem estar marcados is_sellable=true.
-- Corrige 14 itens de legado que não apareciam na proposta por flag não setada.
UPDATE public.materials
   SET is_sellable = true
 WHERE COALESCE(is_sellable,false) = false
   AND material_type IN ('finished_product','composite_product','resale_product');

-- Coerência reversa (defensivo): tipos não-vendáveis não devem estar marcados como
-- vendáveis. (Auditoria atual = 0, mas garante o invariante.)
UPDATE public.materials
   SET is_sellable = false
 WHERE is_sellable = true
   AND material_type NOT IN ('finished_product','composite_product','resale_product');

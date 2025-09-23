-- Adicionar campo de peso unitário na tabela materials
ALTER TABLE public.materials 
ADD COLUMN unit_weight NUMERIC DEFAULT NULL;

-- Comentário sobre o campo
COMMENT ON COLUMN public.materials.unit_weight IS 'Peso unitário em gramas quando a unidade de uso não é de peso (ex: peso de 1 unidade, 1 pacote, etc)';
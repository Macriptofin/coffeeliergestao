-- Adicionar campo total_weight na tabela recipes
ALTER TABLE public.recipes 
ADD COLUMN total_weight NUMERIC DEFAULT NULL;

-- Comentário sobre o campo
COMMENT ON COLUMN public.recipes.total_weight IS 'Peso total da receita em gramas';
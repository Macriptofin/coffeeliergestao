-- Adicionar campos de descrição e marcas permitidas à tabela materials
ALTER TABLE public.materials 
ADD COLUMN description TEXT,
ADD COLUMN allowed_brands TEXT[];
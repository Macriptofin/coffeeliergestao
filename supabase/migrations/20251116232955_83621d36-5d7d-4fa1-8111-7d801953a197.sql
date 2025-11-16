-- Remover constraint que impede novas categorias
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_category_check;

-- Remover constraint de subcategoria se existir
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_subcategory_check;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.materials.category IS 'Categoria do material - valores livres permitidos para migração';
COMMENT ON COLUMN public.materials.subcategory IS 'Subcategoria do material - valores livres permitidos para migração';

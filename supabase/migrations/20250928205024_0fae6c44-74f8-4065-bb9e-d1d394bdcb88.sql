-- Remove old check constraint that only allows legacy categories
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_category_check;

-- Add new check constraint that accepts all taxonomy categories
ALTER TABLE public.materials ADD CONSTRAINT materials_category_check 
CHECK (category IN (
  'Insumo',
  'Embalagem', 
  'Produto Intermediário',
  'Produto Acabado',
  'Produto Composto',
  'Produto de Revenda',
  'Higiene e Limpeza',
  'Equipamentos',
  'Utensílios',
  'Têxteis & Apoios',
  'Infraestrutura & Eventos'
));

-- Update any existing materials that might have non-standard categories
UPDATE public.materials 
SET category = 'Equipamentos'
WHERE category = 'Equipamentos & Utensílios';

-- Create function to validate material categories against taxonomy
CREATE OR REPLACE FUNCTION public.validate_material_category() 
RETURNS trigger AS $$
BEGIN
  -- Allow all categories that exist in taxonomy
  IF NEW.category IS NOT NULL AND NEW.category NOT IN (
    'Insumo', 'Embalagem', 'Produto Intermediário', 'Produto Acabado',
    'Produto Composto', 'Produto de Revenda', 'Higiene e Limpeza',
    'Equipamentos', 'Utensílios', 'Têxteis & Apoios', 'Infraestrutura & Eventos'
  ) THEN
    RAISE EXCEPTION 'Categoria % não é permitida', NEW.category;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
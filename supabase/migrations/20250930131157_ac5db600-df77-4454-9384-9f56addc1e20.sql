-- Drop ALL old material type constraints that might be conflicting
-- and create a single canonical one

-- Drop all possible variations of material type constraints
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_check;
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_ck;

-- Also check for category constraints that might be problematic
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_category_check;

-- Create the definitive constraint set
ALTER TABLE public.materials
  ADD CONSTRAINT materials_material_type_check
  CHECK (
    material_type IN (
      'ingredient',         -- insumo
      'packaging',          -- embalagem/descartável
      'finished_product',   -- produto acabado com receita (BOM)
      'resale_product',     -- produto de revenda (sem receita)
      'composite_product',  -- kit/mesa que agrega
      'intermediate_product'-- produto intermediário com receita (BOM)
    )
  );

ALTER TABLE public.materials
  ADD CONSTRAINT materials_category_check
  CHECK (
    category IN (
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
    )
  );

-- Test query to verify the constraints work
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.materials'::regclass 
  AND contype = 'c';
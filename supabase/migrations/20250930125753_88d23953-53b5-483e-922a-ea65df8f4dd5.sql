-- Fix inconsistent constraint names and allow intermediate_product
-- and expanded categories used by taxonomy

-- 1) Drop both possible constraints for material_type (different names found)
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_ck;
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_check;

-- Recreate a single canonical constraint name with full allowed set
ALTER TABLE public.materials
  ADD CONSTRAINT materials_material_type_ck
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

-- 2) Ensure category constraint matches taxonomy categories we support
-- Drop old category check if present and recreate with expanded set
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_category_check;

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

-- 3) Optional: normalize existing rows with unexpected values (safe no-op if none)
-- This keeps current values; you can add mapping here if needed

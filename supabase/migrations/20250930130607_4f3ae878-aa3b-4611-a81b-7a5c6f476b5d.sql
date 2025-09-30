-- Reforços de segurança para Produto Intermediário

-- 1. Trigger de integridade da saída do BOM
-- Garante que recipes_bom.finished_material_id seja finished ou intermediate
CREATE OR REPLACE FUNCTION public.fn_check_recipes_bom_output()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = NEW.finished_material_id
      AND m.material_type IN ('finished_product', 'intermediate_product')
  ) THEN
    RAISE EXCEPTION 'BOM deve referenciar finished_product ou intermediate_product';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_recipes_bom_output ON public.recipes_bom;
CREATE TRIGGER trg_check_recipes_bom_output
  BEFORE INSERT OR UPDATE ON public.recipes_bom
  FOR EACH ROW 
  EXECUTE FUNCTION public.fn_check_recipes_bom_output();

-- 2. Garantir que produtos intermediários não sejam vendáveis por padrão
UPDATE public.materials
SET is_sellable = false
WHERE material_type = 'intermediate_product'
  AND COALESCE(is_sellable, true);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_materials_type ON public.materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_sellable ON public.materials(is_sellable) WHERE is_sellable = true;
CREATE INDEX IF NOT EXISTS idx_recipes_bom_finished ON public.recipes_bom(finished_material_id);
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_material ON public.recipe_bom_items(material_id);

-- 4. Comentários para documentação
COMMENT ON COLUMN public.materials.material_type IS 'Tipo do material: ingredient, packaging, finished_product, intermediate_product, composite_product, resale_product';
COMMENT ON COLUMN public.materials.is_sellable IS 'Indica se o material pode ser vendido diretamente (produtos intermediários geralmente são false)';
COMMENT ON TABLE public.recipes_bom IS 'BOM (Bill of Materials) para produtos acabados e intermediários';
-- Adicionar coluna is_archived nas tabelas de BOM
ALTER TABLE public.recipes_bom 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

ALTER TABLE public.composites_bom 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Criar índices para performance em consultas de fichas ativas
CREATE INDEX IF NOT EXISTS idx_recipes_bom_archived ON public.recipes_bom(is_archived);
CREATE INDEX IF NOT EXISTS idx_composites_bom_archived ON public.composites_bom(is_archived);

-- Criar função para arquivar ficha técnica (recipe BOM)
CREATE OR REPLACE FUNCTION public.archive_recipe_bom(p_bom_id UUID, p_should_archive BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar material vinculado
  SELECT finished_material_id INTO v_material_id
  FROM public.recipes_bom
  WHERE id = p_bom_id;
  
  IF v_material_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada');
  END IF;
  
  -- Arquivar/desarquivar a BOM
  UPDATE public.recipes_bom
  SET is_archived = p_should_archive,
      updated_at = now()
  WHERE id = p_bom_id;
  
  -- Arquivar/desarquivar o material vinculado
  UPDATE public.materials
  SET is_archived = p_should_archive,
      updated_at = now()
  WHERE id = v_material_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'bom_id', p_bom_id,
    'material_id', v_material_id,
    'archived', p_should_archive
  );
  
  RETURN v_result;
END;
$$;

-- Criar função para arquivar ficha técnica (composite BOM)
CREATE OR REPLACE FUNCTION public.archive_composite_bom(p_bom_id UUID, p_should_archive BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar material vinculado
  SELECT composite_material_id INTO v_material_id
  FROM public.composites_bom
  WHERE id = p_bom_id;
  
  IF v_material_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada');
  END IF;
  
  -- Arquivar/desarquivar a BOM
  UPDATE public.composites_bom
  SET is_archived = p_should_archive,
      updated_at = now()
  WHERE id = p_bom_id;
  
  -- Arquivar/desarquivar o material vinculado
  UPDATE public.materials
  SET is_archived = p_should_archive,
      updated_at = now()
  WHERE id = v_material_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'bom_id', p_bom_id,
    'material_id', v_material_id,
    'archived', p_should_archive
  );
  
  RETURN v_result;
END;
$$;
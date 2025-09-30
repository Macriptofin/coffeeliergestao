
-- Merge de duplicados: consolida todos para INT0005 e limpa órfãos (corrigido)

BEGIN;

-- Função para merge seguro de materiais duplicados
CREATE OR REPLACE FUNCTION public.merge_duplicate_materials(
  p_target_id uuid,
  p_duplicate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  dup_id uuid;
  moved_count integer;
  total_moved integer := 0;
  result jsonb;
BEGIN
  -- Para cada duplicado, mover referências para o target
  FOREACH dup_id IN ARRAY p_duplicate_ids
  LOOP
    -- Mover referências em recipe_bom_items
    UPDATE public.recipe_bom_items
    SET material_id = p_target_id
    WHERE material_id = dup_id;
    GET DIAGNOSTICS moved_count := ROW_COUNT;
    total_moved := total_moved + moved_count;
    
    -- Mover referências em composite_bom_items
    UPDATE public.composite_bom_items
    SET component_material_id = p_target_id
    WHERE component_material_id = dup_id;
    GET DIAGNOSTICS moved_count := ROW_COUNT;
    total_moved := total_moved + moved_count;
    
    -- Mover referências em stock_items (consolidar ou mover)
    UPDATE public.stock_items
    SET material_id = p_target_id
    WHERE material_id = dup_id
      AND NOT EXISTS (SELECT 1 FROM public.stock_items WHERE material_id = p_target_id);
    
    -- Deletar BOMs órfãs do duplicado
    DELETE FROM public.recipe_bom_items
    WHERE recipe_id IN (SELECT id FROM public.recipes_bom WHERE finished_material_id = dup_id);
    
    DELETE FROM public.recipes_bom
    WHERE finished_material_id = dup_id;
    
    -- Deletar o material duplicado
    DELETE FROM public.materials WHERE id = dup_id;
    
    RAISE NOTICE 'Material % merged into % (total refs: %)', dup_id, p_target_id, total_moved;
  END LOOP;
  
  result := jsonb_build_object(
    'target_id', p_target_id,
    'merged_count', array_length(p_duplicate_ids, 1),
    'references_moved', total_moved
  );
  
  RETURN result;
END$$;

-- Executar merge para Massa Para Bolo De Limão
SELECT public.merge_duplicate_materials(
  '241c5d18-5b88-4bce-a5cc-fab7fef074fd'::uuid,  -- INT0005 (target com BOM)
  ARRAY[
    '01185da0-331e-420e-8920-bc7aaf784cb8'::uuid,  -- INT0001
    '40afcc27-eb49-42e3-be1e-ba8e65148b36'::uuid,  -- INT0002
    '2119438d-d16b-438c-94bf-241e6a7f9a9f'::uuid,  -- INT0003
    'e4cf639d-2850-4a93-a0b6-e6bb76e9929d'::uuid   -- INT0004
  ]
);

COMMIT;

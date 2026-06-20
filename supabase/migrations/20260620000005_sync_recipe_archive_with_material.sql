-- Causa-raiz: recipes_bom.is_archived e materials.is_archived drifavam (flags
-- independentes). Resultado: ficha de produto ativo sumia das telas (MAT00276) e
-- ficha de produto arquivado continuava aparecendo na listagem (MAT00168, MAT00175).
-- A ficha técnica deve SEGUIR o estado de arquivamento do seu produto acabado.

-- 1) Corrige os drifts atuais: ficha passa a refletir o material.
UPDATE public.recipes_bom rb
SET is_archived = m.is_archived, updated_at = now()
FROM public.materials m
WHERE m.id = rb.finished_material_id
  AND rb.is_archived IS DISTINCT FROM m.is_archived;

-- 2) Trigger: ao arquivar/reativar um material, sincroniza a(s) ficha(s) dele.
CREATE OR REPLACE FUNCTION public.sync_recipe_archive_with_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
    UPDATE public.recipes_bom
    SET is_archived = NEW.is_archived, updated_at = now()
    WHERE finished_material_id = NEW.id
      AND is_archived IS DISTINCT FROM NEW.is_archived;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_recipe_archive ON public.materials;
CREATE TRIGGER trg_sync_recipe_archive
AFTER UPDATE OF is_archived ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.sync_recipe_archive_with_material();

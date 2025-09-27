-- 1) Adicionar nova feature flag
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('FF_HIDE_LEGACY_RECIPES', 'true', now())
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;

-- 2) Criar schema de backup se não existir
CREATE SCHEMA IF NOT EXISTS backup;

-- 3) Garantir que ops_bom_audit_log existe
CREATE TABLE IF NOT EXISTS public.ops_bom_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);

-- 4) View de diagnóstico do legado (recipes ainda "vivos")
CREATE OR REPLACE VIEW public.vw_legacy_recipes_status AS
SELECT
  r.id as recipe_id,
  r.name,
  r.category,
  r.created_at,
  EXISTS(SELECT 1 FROM public.products p WHERE p.recipe_id = r.id) as referenced_by_products,
  EXISTS(SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id) as has_ingredients,
  (SELECT COUNT(*) FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredients_count
FROM public.recipes r;

-- 5) Função de arquivamento seguro (dry-run por padrão)
CREATE OR REPLACE FUNCTION public.ops_archive_legacy_recipes(dry_run boolean DEFAULT true)
RETURNS TABLE(
  backup_tables text, 
  affected_products int, 
  removed_recipes int, 
  removed_ingredients int
)
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ts text := to_char(now(), 'YYYYMMDD_HH24MISS');
  prod_cnt int := 0;
  rec_cnt int := 0;
  ing_cnt int := 0;
  backup_table_names text;
BEGIN
  -- Sempre criar backups primeiro
  backup_table_names := format('backup.recipes_%s, backup.recipe_ingredients_%s', ts, ts);
  
  EXECUTE format('CREATE TABLE backup.recipes_%s AS SELECT * FROM public.recipes', ts);
  EXECUTE format('CREATE TABLE backup.recipe_ingredients_%s AS SELECT * FROM public.recipe_ingredients', ts);
  
  -- Contagem de produtos referenciando receitas
  SELECT COUNT(*) INTO prod_cnt
  FROM public.products p
  WHERE p.recipe_id IS NOT NULL;
  
  -- Contagem atual de registros
  SELECT COUNT(*) INTO rec_cnt FROM public.recipes;
  SELECT COUNT(*) INTO ing_cnt FROM public.recipe_ingredients;
  
  IF dry_run THEN
    -- Retornar apenas contagens sem fazer alterações
    RETURN QUERY SELECT
      backup_table_names,
      prod_cnt, 
      rec_cnt, 
      ing_cnt;
    RETURN;
  END IF;

  -- Execução real: quebrar vínculos products.recipe_id -> null
  UPDATE public.products
  SET recipe_id = null
  WHERE recipe_id IS NOT NULL;
  
  GET DIAGNOSTICS prod_cnt = ROW_COUNT;

  -- Remover ingredientes e receitas (ordem correta para FKs)
  DELETE FROM public.recipe_ingredients;
  GET DIAGNOSTICS ing_cnt = ROW_COUNT;

  DELETE FROM public.recipes;
  GET DIAGNOSTICS rec_cnt = ROW_COUNT;

  -- Log da operação
  INSERT INTO public.ops_bom_audit_log(action, detail, user_id)
  VALUES ('ARCHIVE_LEGACY_RECIPES', jsonb_build_object(
    'timestamp', now(),
    'backup_tables', backup_table_names,
    'affected_products', prod_cnt,
    'removed_ingredients', ing_cnt,
    'removed_recipes', rec_cnt,
    'dry_run', false
  ), auth.uid());

  RETURN QUERY SELECT
    backup_table_names,
    prod_cnt, 
    rec_cnt, 
    ing_cnt;
END $$;
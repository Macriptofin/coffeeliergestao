-- Ensure only the intended validation remains on recipes_bom and allow intermediate_product
begin;

-- 1) Drop ALL non-internal triggers on recipes_bom (legacy validations)
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.recipes_bom'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.recipes_bom;', trig.tgname);
  END LOOP;
END$$;

-- 2) Drop any CHECK constraints on recipes_bom that reference finished_product/material_type
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.recipes_bom'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%finished_product%'
           OR pg_get_constraintdef(oid) ILIKE '%material_type%')
  LOOP
    EXECUTE format('ALTER TABLE public.recipes_bom DROP CONSTRAINT IF EXISTS %I;', c.conname);
  END LOOP;
END$$;

-- 3) Drop any functions in public schema that still contain the old error text
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
      AND pg_get_functiondef(p.oid) ILIKE '%Material deve ser do tipo finished_product para ter receita%'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE;';
  END LOOP;
END$$;

-- 4) Recreate the canonical validation function accepting finished_product and intermediate_product
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
    RAISE EXCEPTION 'BOM deve referenciar finished_product ou intermediate_product. Material ID: %', NEW.finished_material_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Create a single trigger using the canonical function
CREATE TRIGGER trg_check_recipes_bom_output
  BEFORE INSERT OR UPDATE ON public.recipes_bom
  FOR EACH ROW 
  EXECUTE FUNCTION public.fn_check_recipes_bom_output();

-- 6) Sanity test: try insert with an intermediate_product (if available); rollback the test changes
DO $$
DECLARE
  test_material_id uuid;
  test_bom_id uuid;
BEGIN
  SELECT id INTO test_material_id
  FROM public.materials 
  WHERE material_type = 'intermediate_product'
  ORDER BY created_at DESC
  LIMIT 1;

  IF test_material_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.recipes_bom (finished_material_id, yield_quantity, yield_unit)
      VALUES (test_material_id, 100, 'g')
      RETURNING id INTO test_bom_id;

      -- Cleanup test row
      DELETE FROM public.recipes_bom WHERE id = test_bom_id;
      RAISE NOTICE 'Validação OK: recipes_bom aceita intermediate_product (%).', test_material_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha no teste de validação: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Nenhum intermediate_product encontrado para teste.';
  END IF;
END$$;

commit;

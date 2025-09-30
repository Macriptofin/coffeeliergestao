-- Primeira vamos dropar e recriar a trigger function para garantir que aceita intermediate_product

DROP TRIGGER IF EXISTS trg_check_recipes_bom_output ON public.recipes_bom;
DROP FUNCTION IF EXISTS public.fn_check_recipes_bom_output();

-- Recriar função que aceita finished_product E intermediate_product
CREATE OR REPLACE FUNCTION public.fn_check_recipes_bom_output()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verificar se o material existe e é do tipo correto
  IF NOT EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = NEW.finished_material_id
      AND m.material_type IN ('finished_product', 'intermediate_product')
  ) THEN
    -- Deixar uma mensagem mais clara para debug
    RAISE EXCEPTION 'BOM deve referenciar finished_product ou intermediate_product. Material ID: %', NEW.finished_material_id
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger
CREATE TRIGGER trg_check_recipes_bom_output
  BEFORE INSERT OR UPDATE ON public.recipes_bom
  FOR EACH ROW 
  EXECUTE FUNCTION public.fn_check_recipes_bom_output();

-- Verificar se existe alguma outra função que pode estar causando conflito
-- vamos fazer um teste direto
DO $$
DECLARE
  test_material_id uuid;
BEGIN
  -- Pegar um material intermediate_product existente para teste
  SELECT id INTO test_material_id 
  FROM public.materials 
  WHERE material_type = 'intermediate_product' 
  LIMIT 1;
  
  IF test_material_id IS NOT NULL THEN
    RAISE NOTICE 'Testando com material intermediate_product: %', test_material_id;
    
    -- Tentar inserir um teste (vai falhar se houver outros triggers)
    BEGIN
      INSERT INTO public.recipes_bom (finished_material_id, yield_quantity, yield_unit)
      VALUES (test_material_id, 100, 'g');
      
      -- Se chegou aqui, funcionou - vamos deletar o teste
      DELETE FROM public.recipes_bom WHERE finished_material_id = test_material_id;
      RAISE NOTICE 'Teste BOM intermediate_product: PASSOU';
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Teste BOM intermediate_product: FALHOU - %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Nenhum material intermediate_product encontrado para teste';
  END IF;
END;
$$;
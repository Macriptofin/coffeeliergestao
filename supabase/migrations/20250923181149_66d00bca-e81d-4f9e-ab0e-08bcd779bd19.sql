-- Renomear tabela ingredients para materials
ALTER TABLE public.ingredients RENAME TO materials;

-- Adicionar novos campos para categorização
ALTER TABLE public.materials 
ADD COLUMN category text NOT NULL DEFAULT 'Insumo',
ADD COLUMN code text,
ADD COLUMN material_type text NOT NULL DEFAULT 'ingredient';

-- Criar constraint para categorias válidas
ALTER TABLE public.materials 
ADD CONSTRAINT materials_category_check 
CHECK (category IN ('Insumo', 'Embalagem', 'Produto Acabado', 'Produto Composto'));

-- Criar constraint para tipos válidos
ALTER TABLE public.materials 
ADD CONSTRAINT materials_type_check 
CHECK (material_type IN ('ingredient', 'packaging', 'finished_product', 'composite_product'));

-- Criar função para gerar códigos automáticos
CREATE OR REPLACE FUNCTION public.generate_material_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  prefix text;
  next_number integer;
  new_code text;
BEGIN
  -- Definir prefixos baseados na categoria
  CASE NEW.category
    WHEN 'Insumo' THEN prefix := 'INS';
    WHEN 'Embalagem' THEN prefix := 'EMB';
    WHEN 'Produto Acabado' THEN prefix := 'PAC';
    WHEN 'Produto Composto' THEN prefix := 'PCO';
    ELSE prefix := 'MAT';
  END CASE;
  
  -- Buscar o próximo número para a categoria
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.materials 
  WHERE code LIKE prefix || '%';
  
  -- Gerar código com padding de zeros
  new_code := prefix || LPAD(next_number::text, 4, '0');
  
  NEW.code := new_code;
  RETURN NEW;
END;
$function$;

-- Criar trigger para gerar códigos automaticamente
CREATE TRIGGER generate_material_code_trigger
  BEFORE INSERT ON public.materials
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION public.generate_material_code();

-- Gerar códigos para registros existentes usando cursor
DO $$
DECLARE
    material_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR material_record IN 
        SELECT id FROM public.materials ORDER BY created_at
    LOOP
        UPDATE public.materials 
        SET code = 'INS' || LPAD(counter::text, 4, '0')
        WHERE id = material_record.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Criar index para código único
CREATE UNIQUE INDEX idx_materials_code ON public.materials (code);

-- Atualizar políticas RLS (renomear)
DROP POLICY IF EXISTS "Manage ingredients (auth only)" ON public.materials;

CREATE POLICY "Manage materials (auth only)" 
ON public.materials 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Atualizar referências em outras tabelas
ALTER TABLE public.recipe_ingredients RENAME COLUMN ingredient_id TO material_id;
ALTER TABLE public.stock_items RENAME COLUMN ingredient_id TO material_id;
ALTER TABLE public.stock_movements RENAME COLUMN ingredient_id TO material_id;
ALTER TABLE public.invoice_items RENAME COLUMN ingredient_id TO material_id;
ALTER TABLE public.supplier_products RENAME COLUMN ingredient_id TO material_id;
-- Ensure materials table has proper auto-generation for code field
-- and fix any potential issues with required fields

-- Create function to generate material codes if not exists
CREATE OR REPLACE FUNCTION public.generate_material_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  type_prefix text;
  next_number integer;
  new_code text;
BEGIN
  -- Only generate code if not provided
  IF NEW.code IS NULL OR NEW.code = '' THEN
    -- Get prefix based on material type
    CASE NEW.material_type
      WHEN 'ingredient' THEN type_prefix := 'INS';
      WHEN 'packaging' THEN type_prefix := 'EMB';
      WHEN 'finished_product' THEN type_prefix := 'FIN';
      WHEN 'intermediate_product' THEN type_prefix := 'INT';
      WHEN 'composite_product' THEN type_prefix := 'COM';
      WHEN 'resale_product' THEN type_prefix := 'REV';
      ELSE type_prefix := 'MAT';
    END CASE;
    
    -- Get next number for this type
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.materials 
    WHERE code LIKE type_prefix || '%'
      AND code ~ (type_prefix || '[0-9]+$');
    
    -- Generate code with padding
    new_code := type_prefix || LPAD(next_number::text, 4, '0');
    
    NEW.code := new_code;
  END IF;
  
  -- Ensure required fields have defaults
  IF NEW.purchase_unit IS NULL THEN
    NEW.purchase_unit := 'un';
  END IF;
  
  IF NEW.usage_unit IS NULL THEN
    NEW.usage_unit := NEW.purchase_unit;
  END IF;
  
  IF NEW.conversion_factor IS NULL THEN
    NEW.conversion_factor := 1;
  END IF;
  
  IF NEW.price_per_purchase_unit IS NULL THEN
    NEW.price_per_purchase_unit := 0;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS materials_auto_code ON public.materials;

CREATE TRIGGER materials_auto_code
  BEFORE INSERT ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_material_code();
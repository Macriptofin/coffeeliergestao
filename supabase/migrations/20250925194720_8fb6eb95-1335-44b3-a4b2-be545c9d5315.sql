-- Create function to generate supplier codes
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Buscar o próximo número para fornecedores
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.suppliers 
  WHERE code LIKE 'FORN-%';
  
  -- Gerar código com padding de zeros
  new_code := 'FORN-' || LPAD(next_number::text, 4, '0');
  
  NEW.code := new_code;
  RETURN NEW;
END;
$function$;
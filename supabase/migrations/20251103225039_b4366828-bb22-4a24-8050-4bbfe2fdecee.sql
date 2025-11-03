-- Fix the generate_employee_number trigger to not regenerate number on UPDATE
-- Only generate employee_number on INSERT when it's not provided

CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Only generate on INSERT, not UPDATE
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  
  -- Only generate if not provided
  IF NEW.employee_number IS NULL OR NEW.employee_number = '' THEN
    -- Find next available number
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.employees 
    WHERE employee_number ~ '^FUNC[0-9]+$';
    
    -- Generate number: FUNC0001
    new_number := 'FUNC' || LPAD(next_number::text, 4, '0');
    NEW.employee_number := new_number;
  END IF;
  
  RETURN NEW;
END;
$function$;
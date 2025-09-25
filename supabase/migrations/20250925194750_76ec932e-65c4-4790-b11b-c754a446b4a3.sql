-- Create trigger to automatically generate supplier code
CREATE TRIGGER suppliers_generate_code_trigger
    BEFORE INSERT ON public.suppliers
    FOR EACH ROW
    WHEN (NEW.code IS NULL)
    EXECUTE FUNCTION public.generate_supplier_code();
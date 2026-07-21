-- Numeração automática de cotações (padrão igual generate_proposal_number):
-- reset anual, formato COT-AAAA-NNNN. Sem SECURITY DEFINER — o insert já passa
-- pela RLS normal do usuário autenticado, não precisa de privilégio elevado.
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  IF NEW.quote_number IS NOT NULL AND NEW.quote_number != '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.quote_requests
  WHERE quote_number LIKE 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '%';

  new_number := 'COT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(next_number::text, 4, '0');

  NEW.quote_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_quote_number_trigger
  BEFORE INSERT ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();

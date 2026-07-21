-- purchase_requests.request_number nunca teve trigger de geração (diferente de
-- quote_number/order_number) — o código já insere '' esperando um trigger que
-- não existia; a 2ª requisição de qualquer material estouraria UNIQUE. Mesmo
-- padrão de generate_quote_number: reset anual, sem SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  IF NEW.request_number IS NOT NULL AND NEW.request_number != '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.purchase_requests
  WHERE request_number LIKE 'REQ-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '%';

  new_number := 'REQ-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(next_number::text, 4, '0');

  NEW.request_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_request_number_trigger
  BEFORE INSERT ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_request_number();

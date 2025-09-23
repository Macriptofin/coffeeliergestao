-- Corrigir search_path nas funções criadas
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Buscar o próximo número para produtos
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.products 
  WHERE code LIKE 'PAC%';
  
  -- Gerar código com padding de zeros
  new_code := 'PAC' || LPAD(next_number::text, 4, '0');
  
  NEW.code := new_code;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Buscar o próximo número para propostas do ano atual
  SELECT COALESCE(MAX(CAST(SUBSTRING(proposal_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.proposals 
  WHERE proposal_number LIKE EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '%';
  
  -- Gerar número: AAAA-NNNN
  new_number := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(next_number::text, 4, '0');
  
  NEW.proposal_number := new_number;
  RETURN NEW;
END;
$$;
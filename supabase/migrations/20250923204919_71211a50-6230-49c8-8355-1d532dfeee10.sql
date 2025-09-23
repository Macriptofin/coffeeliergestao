-- Correção final das funções sem search_path definido

-- Corrigir funções existentes que podem não ter search_path fixo
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only create role if user doesn't already have one
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log role changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, new_role
    ) VALUES (
      auth.uid(), 'ROLE_ASSIGNED', NEW.user_id, NEW.role::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, old_role, new_role
    ) VALUES (
      auth.uid(), 'ROLE_UPDATED', NEW.user_id, OLD.role::text, NEW.role::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, old_role
    ) VALUES (
      auth.uid(), 'ROLE_REMOVED', OLD.user_id, OLD.role::text
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_material_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.calculate_weighted_average_price(p_material_id uuid, p_new_quantity numeric, p_new_price numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_stock RECORD;
  new_total_quantity NUMERIC;
  new_total_value NUMERIC;
  new_average_price NUMERIC;
BEGIN
  -- Buscar estoque atual
  SELECT current_quantity, average_price, total_value
  INTO current_stock
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- Se não existe registro de estoque, criar
  IF current_stock IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, average_price, total_value, last_movement_date)
    VALUES (p_material_id, p_new_quantity, p_new_price, p_new_quantity * p_new_price, now());
    RETURN p_new_price;
  END IF;
  
  -- Calcular novo preço médio ponderado
  new_total_quantity := current_stock.current_quantity + p_new_quantity;
  new_total_value := current_stock.total_value + (p_new_quantity * p_new_price);
  
  IF new_total_quantity > 0 THEN
    new_average_price := new_total_value / new_total_quantity;
  ELSE
    new_average_price := 0;
    new_total_value := 0;
  END IF;
  
  -- Atualizar estoque
  UPDATE public.stock_items
  SET 
    current_quantity = new_total_quantity,
    average_price = new_average_price,
    total_value = new_total_value,
    last_movement_date = now(),
    updated_at = now()
  WHERE material_id = p_material_id;
  
  RETURN new_average_price;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
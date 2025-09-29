-- Corrigir search_path das funções de geração de códigos

CREATE OR REPLACE FUNCTION generate_planning_run_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(run_code FROM 'PLAN-([0-9]+)$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.stock_planning_runs
  WHERE run_code LIKE 'PLAN-%';
  
  new_code := 'PLAN-' || LPAD(next_number::text, 6, '0');
  NEW.run_code := new_code;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'PO-([0-9]+)$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.purchase_orders
  WHERE order_number LIKE 'PO-%';
  
  new_number := 'PO-' || LPAD(next_number::text, 6, '0');
  NEW.order_number := new_number;
  RETURN NEW;
END;
$$;
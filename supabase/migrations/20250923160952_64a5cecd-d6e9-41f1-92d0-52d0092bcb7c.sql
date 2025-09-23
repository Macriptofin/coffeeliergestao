-- Sistema de Estoque Completo

-- Tabela de controle de estoque por ingrediente
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC NOT NULL DEFAULT 0,
  average_price NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  last_movement_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_ingredient_stock UNIQUE(ingredient_id)
);

-- Tabela de ordens de compra
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Enviado', 'Recebido', 'Cancelado')),
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de notas fiscais de compra
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Vencido', 'Cancelado')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mapeamento produtos do fornecedor vs ingredientes
CREATE TABLE public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  supplier_product_name TEXT NOT NULL,
  supplier_product_code TEXT,
  supplier_unit TEXT NOT NULL,
  conversion_factor NUMERIC NOT NULL DEFAULT 1, -- Para converter da unidade do fornecedor para nossa unidade
  last_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_supplier_ingredient UNIQUE(supplier_id, ingredient_id)
);

-- Tabela de itens das notas fiscais
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  supplier_product_id UUID NOT NULL REFERENCES public.supplier_products(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações de estoque
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('Entrada', 'Saida', 'Ajuste')),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC,
  reference_type TEXT CHECK (reference_type IN ('Compra', 'Producao', 'Ajuste', 'Perda')),
  reference_id UUID, -- ID da nota fiscal, ordem de produção, etc.
  notes TEXT,
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuários autenticados
CREATE POLICY "Manage stock_items (auth only)" ON public.stock_items
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage purchase_orders (auth only)" ON public.purchase_orders
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage purchase_invoices (auth only)" ON public.purchase_invoices
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage supplier_products (auth only)" ON public.supplier_products
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage invoice_items (auth only)" ON public.invoice_items
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage stock_movements (auth only)" ON public.stock_movements
FOR ALL USING (auth.uid() IS NOT NULL);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_stock_items_updated_at
BEFORE UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_invoices_updated_at
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular preço médio ponderado
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_price(
  p_ingredient_id UUID,
  p_new_quantity NUMERIC,
  p_new_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
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
  WHERE ingredient_id = p_ingredient_id;
  
  -- Se não existe registro de estoque, criar
  IF current_stock IS NULL THEN
    INSERT INTO public.stock_items (ingredient_id, current_quantity, average_price, total_value)
    VALUES (p_ingredient_id, p_new_quantity, p_new_price, p_new_quantity * p_new_price);
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
    last_movement_date = now()
  WHERE ingredient_id = p_ingredient_id;
  
  RETURN new_average_price;
END;
$$;
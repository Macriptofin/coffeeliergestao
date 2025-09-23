-- Criar tabela de fornecedores
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Ativo',
  company_name TEXT NOT NULL,
  trade_name TEXT,
  cnpj_cpf TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  main_category TEXT,
  payment_terms INTEGER DEFAULT 30,
  minimum_order_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Manage suppliers (auth only)" 
ON public.suppliers 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Adicionar foreign key de fornecedor na tabela de ingredientes  
ALTER TABLE public.ingredients 
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);

-- Criar índices para performance
CREATE INDEX idx_suppliers_status ON public.suppliers(status);
CREATE INDEX idx_suppliers_main_category ON public.suppliers(main_category);
CREATE INDEX idx_ingredients_supplier ON public.ingredients(supplier_id);

-- Trigger para updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
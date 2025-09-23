-- Criar enum para categorias de produtos
CREATE TYPE public.product_category AS ENUM ('Salgados', 'Doces', 'Low Fat', 'Bebidas');

-- Criar enum para categorias de eventos
CREATE TYPE public.event_category AS ENUM ('Coffee Break', 'Brunch', 'Coquetel', 'Mesa de Frios');

-- Tabela de clientes
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cnpj_cpf TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  contact_person TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de produtos (baseados em receitas)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  recipe_id UUID REFERENCES public.recipes(id),
  category product_category NOT NULL,
  unit_weight NUMERIC NOT NULL DEFAULT 0, -- peso unitário em gramas
  cost_price NUMERIC NOT NULL DEFAULT 0, -- custo baseado na receita
  selling_price NUMERIC NOT NULL DEFAULT 0, -- preço de venda
  profit_margin NUMERIC, -- margem de lucro %
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de propostas
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  event_category event_category NOT NULL,
  number_of_people INTEGER NOT NULL,
  target_weight_per_person NUMERIC NOT NULL DEFAULT 200, -- gramas por pessoa
  total_target_weight NUMERIC GENERATED ALWAYS AS (number_of_people * target_weight_per_person) STORED,
  proposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_date DATE,
  status TEXT NOT NULL DEFAULT 'Rascunho', -- Rascunho, Enviada, Aprovada, Rejeitada
  version INTEGER NOT NULL DEFAULT 1,
  parent_proposal_id UUID REFERENCES public.proposals(id), -- para versionamento
  notes TEXT,
  total_weight NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens das propostas
CREATE TABLE public.proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_weight NUMERIC NOT NULL, -- peso copiado do produto
  total_weight NUMERIC GENERATED ALWAYS AS (quantity * unit_weight) STORED,
  unit_price NUMERIC NOT NULL, -- preço copiado do produto
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Manage clients (auth only)" ON public.clients FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage products (auth only)" ON public.products FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage proposals (auth only)" ON public.proposals FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage proposal_items (auth only)" ON public.proposal_items FOR ALL USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar código de produto
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger para gerar código automaticamente
CREATE TRIGGER generate_product_code_trigger
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.generate_product_code();

-- Função para gerar número de proposta
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger para gerar número automaticamente
CREATE TRIGGER generate_proposal_number_trigger
  BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.generate_proposal_number();
-- Criar tabelas do sistema MRP + Compras que não existem

-- 1. Tabela de necessidades de compra (gerada automaticamente pelo MRP)
CREATE TABLE public.purchase_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  required_quantity NUMERIC NOT NULL,
  required_unit TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'production_order', 'stock_minimum', 'manual'
  source_id UUID, -- ID da ordem de produção ou outro
  priority TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'requested', 'quoted', 'ordered', 'received', 'cancelled'
  required_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de requisições de compra
CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL UNIQUE,
  requirement_id UUID REFERENCES public.purchase_requirements(id),
  department TEXT NOT NULL,
  justification TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Itens da requisição de compra
CREATE TABLE public.purchase_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  estimated_unit_price NUMERIC,
  estimated_total_price NUMERIC,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Solicitações de cotação
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  request_id UUID REFERENCES public.purchase_requests(id),
  deadline_date DATE NOT NULL,
  delivery_location TEXT,
  payment_terms TEXT,
  special_conditions TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'partial', 'complete', 'expired'
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Fornecedores nas cotações
CREATE TABLE public.quote_request_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  response_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'received', 'declined', 'expired'
  UNIQUE(quote_request_id, supplier_id)
);

-- 6. Cotações recebidas dos fornecedores
CREATE TABLE public.supplier_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  quote_reference TEXT, -- Número da cotação do fornecedor
  valid_until DATE NOT NULL,
  payment_terms TEXT,
  delivery_terms TEXT,
  delivery_time_days INTEGER,
  total_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'received', -- 'received', 'analyzed', 'selected', 'rejected'
  notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analyzed_by UUID REFERENCES auth.users(id),
  analyzed_at TIMESTAMP WITH TIME ZONE
);

-- 7. Itens das cotações
CREATE TABLE public.supplier_quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.supplier_quotes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  brand TEXT,
  specifications TEXT,
  position INTEGER NOT NULL DEFAULT 1
);

-- 8. Log de validações de estoque
CREATE TABLE public.production_stock_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL,
  production_order_type TEXT NOT NULL, -- 'bom', 'event'
  validation_status TEXT NOT NULL, -- 'passed', 'failed'
  missing_materials JSONB, -- Array de materiais em falta
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.purchase_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stock_validations ENABLE ROW LEVEL SECURITY;

-- Criar RLS policies
CREATE POLICY "Admins and managers can manage purchase_requirements"
ON public.purchase_requirements FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage purchase_requests"
ON public.purchase_requests FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage purchase_request_items"
ON public.purchase_request_items FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage quote_requests"
ON public.quote_requests FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage quote_request_suppliers"
ON public.quote_request_suppliers FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage supplier_quotes"
ON public.supplier_quotes FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage supplier_quote_items"
ON public.supplier_quote_items FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage production_stock_validations"
ON public.production_stock_validations FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Criar índices
CREATE INDEX idx_purchase_requirements_material ON public.purchase_requirements(material_id);
CREATE INDEX idx_purchase_requirements_status ON public.purchase_requirements(status);
CREATE INDEX idx_purchase_requirements_priority ON public.purchase_requirements(priority);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX idx_supplier_quotes_supplier ON public.supplier_quotes(supplier_id);

-- Triggers para updated_at
CREATE TRIGGER update_purchase_requirements_updated_at
  BEFORE UPDATE ON public.purchase_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- =====================================================
-- MÓDULO DE VENDAS - MELHORIAS ESTRUTURAIS
-- =====================================================

-- 1. Adicionar campo client_code à tabela clients (código sequencial automático)
-- Primeiro adiciona a coluna
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code TEXT UNIQUE;

-- Criar sequência para códigos de cliente
CREATE SEQUENCE IF NOT EXISTS client_code_seq START WITH 1000;

-- Função para gerar código de cliente automaticamente
CREATE OR REPLACE FUNCTION public.generate_client_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_code IS NULL THEN
    NEW.client_code := 'CLI-' || LPAD(nextval('client_code_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código automaticamente
DROP TRIGGER IF EXISTS trigger_generate_client_code ON public.clients;
CREATE TRIGGER trigger_generate_client_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_code();

-- Atualizar clientes existentes sem código
UPDATE public.clients 
SET client_code = 'CLI-' || LPAD(nextval('client_code_seq')::TEXT, 6, '0')
WHERE client_code IS NULL;

-- 2. Criar tabela de Pedidos de Venda (sales_orders)
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  
  -- Informações hierárquicas do cliente
  department_id UUID REFERENCES public.client_departments(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.client_units(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.client_rooms(id) ON DELETE SET NULL,
  
  -- Datas e prazos
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date DATE,
  delivery_date DATE,
  
  -- Valores
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Detalhes do evento (copiados da proposta)
  event_category TEXT,
  number_of_people INTEGER,
  total_weight NUMERIC(12,2),
  
  -- Status e fluxo
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Em Produção', 'Pronto', 'Entregue', 'Cancelado')),
  payment_status TEXT NOT NULL DEFAULT 'Pendente' CHECK (payment_status IN ('Pendente', 'Parcial', 'Pago', 'Reembolsado')),
  
  -- Rastreabilidade de produção
  production_order_id UUID,
  bom_production_order_id UUID REFERENCES public.bom_production_orders(id) ON DELETE SET NULL,
  event_table_id UUID REFERENCES public.event_tables(id) ON DELETE SET NULL,
  
  -- Observações
  notes TEXT,
  internal_notes TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID
);

-- Criar sequência para números de pedido
CREATE SEQUENCE IF NOT EXISTS sales_order_seq START WITH 1;

-- Função para gerar número de pedido automaticamente
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PED-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('sales_order_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número de pedido
DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.sales_orders;
CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON public.sales_orders;
CREATE TRIGGER update_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_client ON public.sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_proposal ON public.sales_orders(proposal_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON public.sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_event_date ON public.sales_orders(event_date);

-- 3. Tabela de itens do pedido
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  
  -- Referência ao item (produto ou material)
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  
  -- Descrição e detalhes
  description TEXT NOT NULL,
  category TEXT,
  
  -- Quantidades
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_weight NUMERIC(10,2),
  total_weight NUMERIC(10,2),
  
  -- Valores
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Ordenação
  position INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON public.sales_order_items(order_id);

-- 4. Habilitar RLS
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para sales_orders
CREATE POLICY "Usuários autenticados podem visualizar pedidos"
  ON public.sales_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar pedidos"
  ON public.sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar pedidos"
  ON public.sales_orders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir pedidos"
  ON public.sales_orders FOR DELETE
  TO authenticated
  USING (true);

-- 6. Políticas RLS para sales_order_items
CREATE POLICY "Usuários autenticados podem visualizar itens de pedidos"
  ON public.sales_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar itens de pedidos"
  ON public.sales_order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens de pedidos"
  ON public.sales_order_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir itens de pedidos"
  ON public.sales_order_items FOR DELETE
  TO authenticated
  USING (true);

-- 7. Adicionar campo order_id na tabela proposals para rastrear quando virou pedido
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS generated_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_generated_order ON public.proposals(generated_order_id);

-- 8. Função para converter proposta em pedido
CREATE OR REPLACE FUNCTION public.convert_proposal_to_order(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_order_id UUID;
BEGIN
  -- Buscar proposta
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;
  
  IF v_proposal.generated_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proposta já foi convertida em pedido';
  END IF;
  
  -- Criar pedido
  INSERT INTO sales_orders (
    proposal_id,
    client_id,
    department_id,
    contact_id,
    unit_id,
    room_id,
    event_date,
    subtotal,
    total_amount,
    event_category,
    number_of_people,
    total_weight,
    notes,
    created_by
  )
  VALUES (
    p_proposal_id,
    v_proposal.client_id,
    v_proposal.department_id,
    v_proposal.contact_id,
    v_proposal.unit_id,
    v_proposal.room_id,
    v_proposal.event_date,
    v_proposal.total_amount,
    v_proposal.total_amount,
    v_proposal.event_category,
    v_proposal.number_of_people,
    v_proposal.total_weight,
    v_proposal.notes,
    auth.uid()
  )
  RETURNING id INTO v_order_id;
  
  -- Copiar itens da proposta
  INSERT INTO sales_order_items (
    order_id,
    product_id,
    description,
    quantity,
    unit_weight,
    total_weight,
    unit_price,
    total_price,
    position
  )
  SELECT 
    v_order_id,
    pi.product_id,
    COALESCE(p.name, 'Item'),
    pi.quantity,
    pi.unit_weight,
    pi.total_weight,
    pi.unit_price,
    pi.total_price,
    ROW_NUMBER() OVER (ORDER BY pi.created_at)
  FROM proposal_items pi
  LEFT JOIN products p ON p.id = pi.product_id
  WHERE pi.proposal_id = p_proposal_id;
  
  -- Atualizar proposta com referência ao pedido
  UPDATE proposals 
  SET 
    generated_order_id = v_order_id,
    status = 'Aprovada'
  WHERE id = p_proposal_id;
  
  RETURN v_order_id;
END;
$$;
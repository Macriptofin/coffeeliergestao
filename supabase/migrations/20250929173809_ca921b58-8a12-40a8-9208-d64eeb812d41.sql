-- ============================================================================
-- MÓDULO DE PLANEJAMENTO DE ESTOQUE
-- ============================================================================

-- Parâmetros de estoque por material
CREATE TABLE IF NOT EXISTS public.stock_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  abc_classification TEXT CHECK (abc_classification IN ('A', 'B', 'C', 'N/A')) DEFAULT 'N/A',
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  maximum_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  safety_stock NUMERIC NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  review_period_days INTEGER NOT NULL DEFAULT 7,
  unit TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(material_id)
);

-- Execuções de planejamento de estoque
CREATE TABLE IF NOT EXISTS public.stock_planning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code TEXT NOT NULL UNIQUE,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  planning_horizon_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  materials_analyzed INTEGER DEFAULT 0,
  requirements_generated INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  run_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resultados do planejamento de estoque
CREATE TABLE IF NOT EXISTS public.stock_planning_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_run_id UUID NOT NULL REFERENCES public.stock_planning_runs(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  maximum_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  safety_stock NUMERIC NOT NULL DEFAULT 0,
  recommended_quantity NUMERIC NOT NULL DEFAULT 0,
  abc_classification TEXT,
  priority_level TEXT NOT NULL DEFAULT 'normal' CHECK (priority_level IN ('urgent', 'high', 'normal', 'low')),
  unit TEXT NOT NULL,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  requirement_generated BOOLEAN DEFAULT false,
  requirement_id UUID REFERENCES public.purchase_requirements(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- EXPANSÃO DO FLUXO DE COMPRAS
-- ============================================================================

-- Pedidos de compra
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  quote_request_id UUID REFERENCES public.quote_requests(id),
  supplier_quote_id UUID REFERENCES public.supplier_quotes(id),
  expected_delivery_date DATE,
  payment_terms TEXT,
  payment_method TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'partial', 'received', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens dos pedidos de compra
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  quantity_received NUMERIC DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vincular requisições com pedidos de compra
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_requests' 
    AND column_name = 'purchase_order_id'
  ) THEN
    ALTER TABLE public.purchase_requests 
    ADD COLUMN purchase_order_id UUID REFERENCES public.purchase_orders(id);
  END IF;
END $$;

-- ============================================================================
-- TRIGGERS E FUNÇÕES
-- ============================================================================

-- Função para gerar código de planejamento
CREATE OR REPLACE FUNCTION generate_planning_run_code()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_planning_run_code ON public.stock_planning_runs;
CREATE TRIGGER set_planning_run_code BEFORE INSERT ON public.stock_planning_runs
  FOR EACH ROW WHEN (NEW.run_code IS NULL OR NEW.run_code = '')
  EXECUTE FUNCTION generate_planning_run_code();

-- Função para gerar número de pedido
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_purchase_order_number ON public.purchase_orders;
CREATE TRIGGER set_purchase_order_number BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_purchase_order_number();

-- Triggers para updated_at usando função existente
DROP TRIGGER IF EXISTS update_stock_parameters_updated_at ON public.stock_parameters;
CREATE TRIGGER update_stock_parameters_updated_at BEFORE UPDATE ON public.stock_parameters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS update_stock_planning_runs_updated_at ON public.stock_planning_runs;
CREATE TRIGGER update_stock_planning_runs_updated_at BEFORE UPDATE ON public.stock_planning_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.stock_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_planning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_planning_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies para admins e managers
DROP POLICY IF EXISTS "Admins and managers can manage stock_parameters" ON public.stock_parameters;
CREATE POLICY "Admins and managers can manage stock_parameters" ON public.stock_parameters
  FOR ALL USING (is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can manage stock_planning_runs" ON public.stock_planning_runs;
CREATE POLICY "Admins and managers can manage stock_planning_runs" ON public.stock_planning_runs
  FOR ALL USING (is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can view stock_planning_results" ON public.stock_planning_results;
CREATE POLICY "Admins and managers can view stock_planning_results" ON public.stock_planning_results
  FOR SELECT USING (is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can manage purchase_orders" ON public.purchase_orders;
CREATE POLICY "Admins and managers can manage purchase_orders" ON public.purchase_orders
  FOR ALL USING (is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can view purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Admins and managers can view purchase_order_items" ON public.purchase_order_items
  FOR SELECT USING (is_admin_or_manager(auth.uid()));

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_parameters_material ON public.stock_parameters(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_parameters_abc ON public.stock_parameters(abc_classification);
CREATE INDEX IF NOT EXISTS idx_stock_planning_results_run ON public.stock_planning_results(planning_run_id);
CREATE INDEX IF NOT EXISTS idx_stock_planning_results_material ON public.stock_planning_results(material_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_po ON public.purchase_requests(purchase_order_id);
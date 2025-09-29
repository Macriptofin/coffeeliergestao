-- Criar tabela para armazenar ordens de produção BOM
CREATE TABLE IF NOT EXISTS public.bom_production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_name text NOT NULL,
  order_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  total_cost numeric(14,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Itens da ordem de produção BOM
CREATE TABLE IF NOT EXISTS public.bom_production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.bom_production_orders(id) ON DELETE CASCADE,
  bom_id uuid NOT NULL REFERENCES public.recipes_bom(id),
  quantity integer NOT NULL DEFAULT 1,
  multiplier numeric(8,2) NOT NULL DEFAULT 1,
  total_yield_quantity numeric(14,6) NOT NULL,
  yield_unit text NOT NULL,
  item_cost numeric(14,2) DEFAULT 0,
  position integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

-- Materiais consolidados para cada ordem
CREATE TABLE IF NOT EXISTS public.bom_production_consolidated_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.bom_production_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  total_quantity numeric(14,6) NOT NULL,
  unit text NOT NULL,
  total_cost numeric(14,2) DEFAULT 0,
  reserved_quantity numeric(14,6) DEFAULT 0,
  consumed_quantity numeric(14,6) DEFAULT 0,
  is_reserved boolean DEFAULT false,
  is_consumed boolean DEFAULT false,
  used_in_boms jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now()
);

-- Movimentações de estoque relacionadas às ordens
CREATE TABLE IF NOT EXISTS public.bom_production_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.bom_production_orders(id),
  material_id uuid NOT NULL REFERENCES public.materials(id),
  movement_type text NOT NULL CHECK (movement_type IN ('reserve', 'unreserve', 'consume', 'produce')),
  quantity numeric(14,6) NOT NULL,
  unit text NOT NULL,
  reference_table text,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bom_production_orders_status ON public.bom_production_orders(status);
CREATE INDEX IF NOT EXISTS idx_bom_production_orders_date ON public.bom_production_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_bom_production_order_items_order_id ON public.bom_production_order_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_bom_production_consolidated_materials_order_id ON public.bom_production_consolidated_materials(production_order_id);
CREATE INDEX IF NOT EXISTS idx_bom_production_stock_movements_order_id ON public.bom_production_stock_movements(production_order_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_bom_production_orders_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bom_production_orders_updated_at
  BEFORE UPDATE ON public.bom_production_orders
  FOR EACH ROW EXECUTE FUNCTION update_bom_production_orders_updated_at();

-- RLS Policies
ALTER TABLE public.bom_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_production_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_production_consolidated_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_production_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage bom_production_orders" 
ON public.bom_production_orders FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage bom_production_order_items" 
ON public.bom_production_order_items FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage bom_production_consolidated_materials" 
ON public.bom_production_consolidated_materials FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage bom_production_stock_movements" 
ON public.bom_production_stock_movements FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Funções para gerenciar reserva e consumo de estoque
CREATE OR REPLACE FUNCTION public.reserve_materials_for_production(p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  material_record RECORD;
BEGIN
  -- Marcar materiais como reservados
  FOR material_record IN
    SELECT * FROM public.bom_production_consolidated_materials
    WHERE production_order_id = p_production_order_id
      AND is_reserved = false
  LOOP
    -- Criar movimento de reserva
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, material_record.material_id, 'reserve', 
      material_record.total_quantity, material_record.unit, 
      'Reserva automática para produção', auth.uid()
    );
    
    -- Atualizar status de reserva
    UPDATE public.bom_production_consolidated_materials
    SET is_reserved = true, reserved_quantity = total_quantity
    WHERE id = material_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_materials_for_production(p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  material_record RECORD;
BEGIN
  -- Consumir materiais reservados
  FOR material_record IN
    SELECT * FROM public.bom_production_consolidated_materials
    WHERE production_order_id = p_production_order_id
      AND is_reserved = true AND is_consumed = false
  LOOP
    -- Processar consumo via função existente
    PERFORM public.process_component_consumption(
      material_record.material_id,
      material_record.total_quantity,
      material_record.unit,
      'PRODUCTION_CONSUMPTION',
      p_production_order_id
    );
    
    -- Criar movimento de consumo
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, material_record.material_id, 'consume', 
      material_record.total_quantity, material_record.unit, 
      'Consumo automático para produção', auth.uid()
    );
    
    -- Atualizar status de consumo
    UPDATE public.bom_production_consolidated_materials
    SET is_consumed = true, consumed_quantity = total_quantity
    WHERE id = material_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.produce_finished_products_for_order(p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
  bom_record RECORD;
BEGIN
  -- Produzir produtos acabados
  FOR item_record IN
    SELECT * FROM public.bom_production_order_items
    WHERE production_order_id = p_production_order_id
  LOOP
    -- Buscar dados do BOM
    SELECT rb.*, m.* INTO bom_record
    FROM public.recipes_bom rb
    JOIN public.materials m ON m.id = rb.finished_material_id
    WHERE rb.id = item_record.bom_id;
    
    -- Criar entrada do produto acabado
    PERFORM public.process_finish_input(
      bom_record.finished_material_id,
      item_record.total_yield_quantity,
      'PRODUCTION_INPUT'
    );
    
    -- Criar movimento de produção
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, bom_record.finished_material_id, 'produce', 
      item_record.total_yield_quantity, item_record.yield_unit, 
      'Produção de ' || bom_record.name, auth.uid()
    );
  END LOOP;
END;
$$;

-- Função para alterar status da ordem
CREATE OR REPLACE FUNCTION public.update_production_order_status(
  p_production_order_id uuid, 
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_status text;
BEGIN
  -- Buscar status atual
  SELECT status INTO current_status
  FROM public.bom_production_orders
  WHERE id = p_production_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de produção não encontrada';
  END IF;
  
  -- Validar transições de status
  IF current_status = 'planned' AND p_new_status = 'in_progress' THEN
    -- Reservar materiais
    PERFORM public.reserve_materials_for_production(p_production_order_id);
    
    UPDATE public.bom_production_orders
    SET status = p_new_status, started_at = now()
    WHERE id = p_production_order_id;
    
  ELSIF current_status = 'in_progress' AND p_new_status = 'completed' THEN
    -- Consumir materiais e produzir produtos
    PERFORM public.consume_materials_for_production(p_production_order_id);
    PERFORM public.produce_finished_products_for_order(p_production_order_id);
    
    UPDATE public.bom_production_orders
    SET status = p_new_status, completed_at = now()
    WHERE id = p_production_order_id;
    
  ELSIF p_new_status = 'cancelled' THEN
    -- Cancelar: desfazer reservas se necessário
    UPDATE public.bom_production_consolidated_materials
    SET is_reserved = false, reserved_quantity = 0
    WHERE production_order_id = p_production_order_id
      AND is_consumed = false;
    
    UPDATE public.bom_production_orders
    SET status = p_new_status
    WHERE id = p_production_order_id;
    
  ELSE
    RAISE EXCEPTION 'Transição de status inválida: % para %', current_status, p_new_status;
  END IF;
END;
$$;
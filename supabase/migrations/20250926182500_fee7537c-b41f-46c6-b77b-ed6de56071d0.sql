-- Create inventory adjustments tables for audit-compliant stock management

-- Table for inventory counts and adjustments
CREATE TABLE public.inventory_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  adjustment_time TIME NOT NULL DEFAULT CURRENT_TIME,
  system_quantity NUMERIC NOT NULL DEFAULT 0,
  physical_quantity NUMERIC NOT NULL,
  quantity_difference NUMERIC GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  adjustment_reason TEXT NOT NULL,
  reference_document TEXT,
  responsible_user_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for cost/value adjustments
CREATE TABLE public.cost_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  adjustment_time TIME NOT NULL DEFAULT CURRENT_TIME,
  old_unit_cost NUMERIC NOT NULL,
  new_unit_cost NUMERIC NOT NULL,
  cost_difference NUMERIC GENERATED ALWAYS AS (new_unit_cost - old_unit_cost) STORED,
  current_quantity NUMERIC NOT NULL,
  old_total_value NUMERIC GENERATED ALWAYS AS (old_unit_cost * current_quantity) STORED,
  new_total_value NUMERIC GENERATED ALWAYS AS (new_unit_cost * current_quantity) STORED,
  adjustment_reason TEXT NOT NULL,
  reference_document TEXT,
  responsible_user_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Only admins and managers can manage inventory_adjustments" 
ON public.inventory_adjustments 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can manage cost_adjustments" 
ON public.cost_adjustments 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_inventory_adjustments_material_id ON public.inventory_adjustments(material_id);
CREATE INDEX idx_inventory_adjustments_date ON public.inventory_adjustments(adjustment_date);
CREATE INDEX idx_cost_adjustments_material_id ON public.cost_adjustments(material_id);
CREATE INDEX idx_cost_adjustments_date ON public.cost_adjustments(adjustment_date);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_adjustments_updated_at
  BEFORE UPDATE ON public.inventory_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_adjustments_updated_at
  BEFORE UPDATE ON public.cost_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process inventory adjustment and update stock
CREATE OR REPLACE FUNCTION public.process_inventory_adjustment(
  p_material_id UUID,
  p_physical_quantity NUMERIC,
  p_adjustment_reason TEXT,
  p_reference_document TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_quantity NUMERIC;
  v_adjustment_id UUID;
  v_quantity_diff NUMERIC;
BEGIN
  -- Get current system quantity
  SELECT COALESCE(current_quantity, 0) INTO v_system_quantity
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- If no stock record exists, create one
  IF v_system_quantity IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, minimum_quantity)
    VALUES (p_material_id, 0, 0);
    v_system_quantity := 0;
  END IF;
  
  -- Calculate difference
  v_quantity_diff := p_physical_quantity - v_system_quantity;
  
  -- Create inventory adjustment record
  INSERT INTO public.inventory_adjustments (
    material_id,
    system_quantity,
    physical_quantity,
    adjustment_reason,
    reference_document,
    responsible_user_id,
    notes
  ) VALUES (
    p_material_id,
    v_system_quantity,
    p_physical_quantity,
    p_adjustment_reason,
    p_reference_document,
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_adjustment_id;
  
  -- Update stock quantity if there's a difference
  IF v_quantity_diff != 0 THEN
    UPDATE public.stock_items
    SET 
      current_quantity = p_physical_quantity,
      last_movement_date = now(),
      updated_at = now()
    WHERE material_id = p_material_id;
    
    -- Create stock movement record for audit trail
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      p_material_id,
      CASE WHEN v_quantity_diff > 0 THEN 'Ajuste Positivo' ELSE 'Ajuste Negativo' END,
      ABS(v_quantity_diff),
      'inventory_adjustment',
      v_adjustment_id,
      'Ajuste de inventário: ' || p_adjustment_reason
    );
  END IF;
  
  RETURN v_adjustment_id;
END;
$$;

-- Function to process cost adjustment
CREATE OR REPLACE FUNCTION public.process_cost_adjustment(
  p_material_id UUID,
  p_new_unit_cost NUMERIC,
  p_adjustment_reason TEXT,
  p_reference_document TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_unit_cost NUMERIC;
  v_current_quantity NUMERIC;
  v_adjustment_id UUID;
BEGIN
  -- Get current cost and quantity
  SELECT COALESCE(average_price, 0), COALESCE(current_quantity, 0)
  INTO v_old_unit_cost, v_current_quantity
  FROM public.stock_items
  WHERE material_id = p_material_id;
  
  -- If no stock record exists, create one
  IF v_old_unit_cost IS NULL THEN
    INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity)
    VALUES (p_material_id, 0, p_new_unit_cost, 0);
    v_old_unit_cost := 0;
    v_current_quantity := 0;
  END IF;
  
  -- Create cost adjustment record
  INSERT INTO public.cost_adjustments (
    material_id,
    old_unit_cost,
    new_unit_cost,
    current_quantity,
    adjustment_reason,
    reference_document,
    responsible_user_id,
    notes
  ) VALUES (
    p_material_id,
    v_old_unit_cost,
    p_new_unit_cost,
    v_current_quantity,
    p_adjustment_reason,
    p_reference_document,
    auth.uid(),
    p_notes
  ) RETURNING id INTO v_adjustment_id;
  
  -- Update stock with new cost
  UPDATE public.stock_items
  SET 
    average_price = p_new_unit_cost,
    total_value = p_new_unit_cost * current_quantity,
    updated_at = now()
  WHERE material_id = p_material_id;
  
  RETURN v_adjustment_id;
END;
$$;
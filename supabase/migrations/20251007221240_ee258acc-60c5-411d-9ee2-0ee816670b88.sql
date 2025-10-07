-- 1. Adicionar campos de status de custo em bom_production_orders
ALTER TABLE public.bom_production_orders
ADD COLUMN IF NOT EXISTS cost_status text DEFAULT 'complete' CHECK (cost_status IN ('complete', 'partial', 'unknown')),
ADD COLUMN IF NOT EXISTS missing_cost_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bom_production_orders.cost_status IS 'Status da completude do custo: complete, partial, unknown';
COMMENT ON COLUMN public.bom_production_orders.missing_cost_items IS 'Lista de materiais sem custo disponível';

-- 2. Função para obter preço de material com fallback hierárquico
CREATE OR REPLACE FUNCTION public.get_material_cost(p_material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost numeric := 0;
  v_material_type text;
  v_cached_bom_cost numeric;
BEGIN
  -- Buscar tipo do material
  SELECT material_type INTO v_material_type
  FROM public.materials
  WHERE id = p_material_id;
  
  -- 1. Para produtos acabados/intermediários/compostos, usar custo da BOM
  IF v_material_type IN ('finished_product', 'intermediate_product', 'composite_product') THEN
    -- Buscar custo calculado da BOM
    IF v_material_type = 'composite_product' THEN
      SELECT cached_total_cost INTO v_cached_bom_cost
      FROM public.composites_bom
      WHERE composite_material_id = p_material_id
      AND is_archived = false
      LIMIT 1;
    ELSE
      SELECT cached_total_cost INTO v_cached_bom_cost
      FROM public.recipes_bom
      WHERE finished_material_id = p_material_id
      AND is_archived = false
      LIMIT 1;
    END IF;
    
    -- Se tem custo calculado, usar
    IF v_cached_bom_cost IS NOT NULL AND v_cached_bom_cost > 0 THEN
      RETURN v_cached_bom_cost;
    END IF;
    
    -- Senão, tentar calcular recursivamente
    v_cost := public.calculate_bom_cost_recursive(p_material_id, v_material_type);
    IF v_cost > 0 THEN
      RETURN v_cost;
    END IF;
  END IF;
  
  -- 2. Fallback: average_price do estoque (já está em usage_unit)
  SELECT average_price INTO v_cost
  FROM public.stock_items
  WHERE material_id = p_material_id
  AND average_price IS NOT NULL
  AND average_price > 0;
  
  IF v_cost IS NOT NULL AND v_cost > 0 THEN
    RETURN v_cost;
  END IF;
  
  -- 3. Fallback: último preço de compra
  SELECT unit_price INTO v_cost
  FROM public.purchase_invoice_items pii
  JOIN public.purchase_invoices pi ON pi.id = pii.invoice_id
  WHERE pii.material_id = p_material_id
  AND pii.unit_price > 0
  ORDER BY pi.invoice_date DESC, pii.created_at DESC
  LIMIT 1;
  
  IF v_cost IS NOT NULL AND v_cost > 0 THEN
    -- Converter de purchase_unit para usage_unit
    SELECT v_cost / COALESCE(conversion_factor, 1) INTO v_cost
    FROM public.materials
    WHERE id = p_material_id;
    
    RETURN v_cost;
  END IF;
  
  -- 4. Fallback final: price_per_purchase_unit do cadastro
  SELECT price_per_purchase_unit / COALESCE(conversion_factor, 1) INTO v_cost
  FROM public.materials
  WHERE id = p_material_id
  AND price_per_purchase_unit > 0;
  
  RETURN COALESCE(v_cost, 0);
END;
$$;

COMMENT ON FUNCTION public.get_material_cost(uuid) IS 'Retorna custo do material com fallback hierárquico: BOM → estoque → última compra → cadastro';

-- 3. Função recursiva para calcular custo de BOM
CREATE OR REPLACE FUNCTION public.calculate_bom_cost_recursive(p_material_id uuid, p_material_type text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_cost numeric := 0;
  v_item_cost numeric;
  v_item record;
BEGIN
  -- Calcular custo dos itens da BOM
  IF p_material_type = 'composite_product' THEN
    FOR v_item IN
      SELECT cbi.component_material_id, cbi.quantity, cbi.unit
      FROM public.composite_bom_items cbi
      JOIN public.composites_bom cb ON cb.id = cbi.composite_id
      WHERE cb.composite_material_id = p_material_id
      AND cb.is_archived = false
    LOOP
      -- Buscar custo do componente (recursivo)
      v_item_cost := public.get_material_cost(v_item.component_material_id);
      v_total_cost := v_total_cost + (v_item.quantity * v_item_cost);
    END LOOP;
  ELSE
    FOR v_item IN
      SELECT rbi.material_id, rbi.quantity, rbi.unit, COALESCE(rbi.waste_percent, 0) as waste_percent
      FROM public.recipe_bom_items rbi
      JOIN public.recipes_bom rb ON rb.id = rbi.recipe_id
      WHERE rb.finished_material_id = p_material_id
      AND rb.is_archived = false
    LOOP
      -- Buscar custo do ingrediente (recursivo)
      v_item_cost := public.get_material_cost(v_item.material_id);
      
      -- Aplicar perda
      v_total_cost := v_total_cost + (v_item.quantity * v_item_cost * (1 + v_item.waste_percent / 100));
    END LOOP;
  END IF;
  
  RETURN v_total_cost;
END;
$$;

COMMENT ON FUNCTION public.calculate_bom_cost_recursive(uuid, text) IS 'Calcula custo total da BOM recursivamente considerando todos os níveis';

-- 4. Função para validar disponibilidade de estoque para produção
CREATE OR REPLACE FUNCTION public.check_production_availability(p_bom_id uuid, p_bom_type text, p_multiplier numeric DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{"available": true, "missing_items": []}'::jsonb;
  v_missing_items jsonb[] := '{}';
  v_item record;
  v_needed numeric;
  v_available numeric;
  v_missing numeric;
BEGIN
  IF p_bom_type = 'composite' THEN
    FOR v_item IN
      SELECT 
        m.id as material_id,
        m.name as material_name,
        cbi.quantity,
        cbi.unit,
        COALESCE(si.current_quantity, 0) as stock_quantity
      FROM public.composite_bom_items cbi
      JOIN public.materials m ON m.id = cbi.component_material_id
      LEFT JOIN public.stock_items si ON si.material_id = m.id
      WHERE cbi.composite_id = p_bom_id
    LOOP
      v_needed := v_item.quantity * p_multiplier;
      v_available := v_item.stock_quantity;
      v_missing := GREATEST(v_needed - v_available, 0);
      
      IF v_missing > 0 THEN
        v_missing_items := v_missing_items || jsonb_build_object(
          'material_id', v_item.material_id,
          'material_name', v_item.material_name,
          'needed', v_needed,
          'available', v_available,
          'missing', v_missing,
          'unit', v_item.unit
        );
      END IF;
    END LOOP;
  ELSE
    FOR v_item IN
      SELECT 
        m.id as material_id,
        m.name as material_name,
        rbi.quantity,
        rbi.unit,
        COALESCE(rbi.waste_percent, 0) as waste_percent,
        COALESCE(si.current_quantity, 0) as stock_quantity
      FROM public.recipe_bom_items rbi
      JOIN public.materials m ON m.id = rbi.material_id
      LEFT JOIN public.stock_items si ON si.material_id = m.id
      WHERE rbi.recipe_id = p_bom_id
    LOOP
      v_needed := v_item.quantity * p_multiplier * (1 + v_item.waste_percent / 100);
      v_available := v_item.stock_quantity;
      v_missing := GREATEST(v_needed - v_available, 0);
      
      IF v_missing > 0 THEN
        v_missing_items := v_missing_items || jsonb_build_object(
          'material_id', v_item.material_id,
          'material_name', v_item.material_name,
          'needed', v_needed,
          'available', v_available,
          'missing', v_missing,
          'unit', v_item.unit
        );
      END IF;
    END LOOP;
  END IF;
  
  IF array_length(v_missing_items, 1) > 0 THEN
    v_result := jsonb_build_object(
      'available', false,
      'missing_items', v_missing_items
    );
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_production_availability(uuid, text, numeric) IS 'Verifica disponibilidade de estoque para produção e retorna itens faltantes';
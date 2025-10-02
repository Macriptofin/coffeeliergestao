-- =====================================================
-- FASE 2: Funções de Análise e Recálculo Histórico
-- =====================================================

-- Função para analisar preços históricos de um material
CREATE OR REPLACE FUNCTION public.analyze_material_price_history(p_material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_current_stock RECORD;
  v_movements JSONB;
  v_analysis JSONB;
  v_suspicious_count INTEGER := 0;
  v_total_movements INTEGER := 0;
BEGIN
  -- Buscar material
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material não encontrado');
  END IF;
  
  -- Buscar estado atual do estoque
  SELECT * INTO v_current_stock FROM public.stock_items WHERE material_id = p_material_id;
  
  -- Buscar movimentos históricos
  SELECT COUNT(*) INTO v_total_movements
  FROM public.stock_movements
  WHERE material_id = p_material_id AND movement_type = 'Entrada';
  
  -- Identificar movimentos suspeitos (preços anormalmente altos/baixos)
  WITH price_stats AS (
    SELECT
      AVG(unit_price) as avg_price,
      STDDEV(unit_price) as stddev_price,
      MIN(unit_price) as min_price,
      MAX(unit_price) as max_price
    FROM public.stock_movements
    WHERE material_id = p_material_id AND movement_type = 'Entrada' AND unit_price > 0
  )
  SELECT COUNT(*) INTO v_suspicious_count
  FROM public.stock_movements sm, price_stats ps
  WHERE sm.material_id = p_material_id
    AND sm.movement_type = 'Entrada'
    AND sm.unit_price > 0
    AND (
      sm.unit_price > ps.avg_price + (2 * ps.stddev_price) OR
      sm.unit_price < ps.avg_price - (2 * ps.stddev_price)
    );
  
  -- Buscar últimos 10 movimentos para análise detalhada
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'movement_date', movement_date,
      'movement_type', movement_type,
      'quantity', quantity,
      'unit_price', unit_price,
      'notes', notes
    ) ORDER BY movement_date DESC
  ) INTO v_movements
  FROM (
    SELECT * FROM public.stock_movements
    WHERE material_id = p_material_id
    ORDER BY movement_date DESC
    LIMIT 10
  ) recent;
  
  RETURN jsonb_build_object(
    'success', true,
    'material', jsonb_build_object(
      'id', v_material.id,
      'name', v_material.name,
      'purchase_unit', v_material.purchase_unit,
      'usage_unit', v_material.usage_unit,
      'conversion_factor', v_material.conversion_factor
    ),
    'current_stock', jsonb_build_object(
      'quantity', COALESCE(v_current_stock.current_quantity, 0),
      'average_price', COALESCE(v_current_stock.average_price, 0),
      'total_value', COALESCE(v_current_stock.total_value, 0)
    ),
    'statistics', jsonb_build_object(
      'total_movements', v_total_movements,
      'suspicious_movements', v_suspicious_count,
      'needs_review', v_suspicious_count > 0 OR v_total_movements = 0
    ),
    'recent_movements', COALESCE(v_movements, '[]'::jsonb)
  );
END;
$$;

-- Função para recalcular preço médio de um material (CUIDADOSA)
CREATE OR REPLACE FUNCTION public.recalculate_material_average_price(
  p_material_id uuid,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material RECORD;
  v_current_stock RECORD;
  v_movement RECORD;
  v_running_quantity numeric := 0;
  v_running_avg_price numeric := 0;
  v_new_quantity numeric;
  v_new_avg_price numeric;
  v_recalc_steps jsonb := '[]'::jsonb;
  v_final_avg_price numeric;
BEGIN
  -- Buscar material
  SELECT * INTO v_material FROM public.materials WHERE id = p_material_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material não encontrado');
  END IF;
  
  -- Buscar estado atual
  SELECT * INTO v_current_stock FROM public.stock_items WHERE material_id = p_material_id FOR UPDATE;
  
  -- Recalcular baseado em movimentos de entrada em ordem cronológica
  FOR v_movement IN
    SELECT * FROM public.stock_movements
    WHERE material_id = p_material_id
      AND movement_type = 'Entrada'
      AND unit_price > 0
    ORDER BY movement_date ASC, created_at ASC
  LOOP
    v_new_quantity := v_running_quantity + v_movement.quantity;
    
    IF v_new_quantity > 0 THEN
      v_new_avg_price := ((v_running_quantity * v_running_avg_price) + (v_movement.quantity * v_movement.unit_price)) / v_new_quantity;
    ELSE
      v_new_avg_price := v_movement.unit_price;
    END IF;
    
    v_recalc_steps := v_recalc_steps || jsonb_build_object(
      'movement_id', v_movement.id,
      'date', v_movement.movement_date,
      'quantity_added', v_movement.quantity,
      'unit_price', v_movement.unit_price,
      'stock_before', v_running_quantity,
      'avg_price_before', v_running_avg_price,
      'stock_after', v_new_quantity,
      'avg_price_after', v_new_avg_price
    );
    
    v_running_quantity := v_new_quantity;
    v_running_avg_price := v_new_avg_price;
  END LOOP;
  
  v_final_avg_price := v_running_avg_price;
  
  -- Se não é dry run, atualizar o estoque
  IF NOT p_dry_run AND v_current_stock.id IS NOT NULL THEN
    UPDATE public.stock_items
    SET average_price = v_final_avg_price,
        total_value = current_quantity * v_final_avg_price,
        updated_at = now()
    WHERE material_id = p_material_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'material_id', p_material_id,
    'material_name', v_material.name,
    'old_average_price', COALESCE(v_current_stock.average_price, 0),
    'new_average_price', v_final_avg_price,
    'current_quantity', COALESCE(v_current_stock.current_quantity, 0),
    'price_difference', v_final_avg_price - COALESCE(v_current_stock.average_price, 0),
    'recalculation_steps', v_recalc_steps,
    'applied', NOT p_dry_run
  );
END;
$$;

-- Função para análise geral do sistema
CREATE OR REPLACE FUNCTION public.analyze_system_pricing_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_materials INTEGER;
  v_materials_with_stock INTEGER;
  v_materials_no_price INTEGER;
  v_materials_no_movement INTEGER;
  v_materials_suspicious INTEGER;
  v_problem_materials jsonb;
BEGIN
  -- Contadores gerais
  SELECT COUNT(*) INTO v_total_materials FROM public.materials WHERE material_type = 'ingredient';
  
  SELECT COUNT(*) INTO v_materials_with_stock
  FROM public.stock_items
  WHERE current_quantity > 0;
  
  SELECT COUNT(*) INTO v_materials_no_price
  FROM public.stock_items
  WHERE average_price = 0 OR average_price IS NULL;
  
  SELECT COUNT(*) INTO v_materials_no_movement
  FROM public.materials m
  LEFT JOIN public.stock_movements sm ON sm.material_id = m.id
  WHERE m.material_type = 'ingredient'
  GROUP BY m.id
  HAVING COUNT(sm.id) = 0;
  
  -- Materiais problemáticos
  SELECT jsonb_agg(
    jsonb_build_object(
      'material_id', m.id,
      'material_name', m.name,
      'issue', CASE
        WHEN si.average_price = 0 OR si.average_price IS NULL THEN 'Sem preço'
        WHEN si.current_quantity > 0 AND si.average_price = 0 THEN 'Estoque sem preço'
        WHEN m.conversion_factor <= 0 THEN 'Fator conversão inválido'
        ELSE 'Outros'
      END,
      'current_quantity', COALESCE(si.current_quantity, 0),
      'average_price', COALESCE(si.average_price, 0)
    )
  ) INTO v_problem_materials
  FROM public.materials m
  LEFT JOIN public.stock_items si ON si.material_id = m.id
  WHERE m.material_type = 'ingredient'
    AND (
      si.average_price = 0 OR si.average_price IS NULL OR
      (si.current_quantity > 0 AND si.average_price = 0) OR
      m.conversion_factor <= 0
    )
  LIMIT 50;
  
  RETURN jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'total_materials', v_total_materials,
      'materials_with_stock', v_materials_with_stock,
      'materials_no_price', v_materials_no_price,
      'materials_no_movement', COALESCE(v_materials_no_movement, 0)
    ),
    'health_score', CASE
      WHEN v_materials_no_price = 0 THEN 100
      ELSE GREATEST(0, 100 - (v_materials_no_price * 100.0 / NULLIF(v_total_materials, 0)))
    END,
    'problem_materials', COALESCE(v_problem_materials, '[]'::jsonb),
    'recommendations', jsonb_build_array(
      CASE WHEN v_materials_no_price > 0 THEN 'Adicionar preços para materiais sem custo' END,
      CASE WHEN v_materials_no_movement > 5 THEN 'Registrar entradas de estoque' END
    ) - NULL
  );
END;
$$;

COMMENT ON FUNCTION public.analyze_material_price_history IS 'Analisa histórico de preços e movimentos de um material específico';
COMMENT ON FUNCTION public.recalculate_material_average_price IS 'Recalcula preço médio baseado em histórico. Use dry_run=true primeiro!';
COMMENT ON FUNCTION public.analyze_system_pricing_health IS 'Análise geral de saúde do sistema de precificação';
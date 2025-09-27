-- FASE 3 - FUNÇÕES DE CÁLCULO E GERAÇÃO
-- Criando funções para o módulo Mesas/Eventos

-- 3.1 Helper para calcular quantidade planejada por item do evento
CREATE OR REPLACE FUNCTION public.compute_event_item_planned_qty(
  p_event_table_id uuid,
  p_item_id uuid DEFAULT NULL
)
RETURNS TABLE(
  material_id uuid,
  planned_qty numeric,
  planned_unit text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eti.material_id,
    CASE 
      WHEN eti.fixed_quantity IS NOT NULL AND eti.fixed_quantity > 0 
      THEN eti.fixed_quantity
      ELSE et.attendees * COALESCE(eti.quantity_per_person, 0)
    END as planned_qty,
    COALESCE(
      eti.unit_override, 
      m.usage_unit,
      m.purchase_unit
    ) as planned_unit
  FROM public.event_table_items eti
  JOIN public.event_tables et ON et.id = eti.event_table_id
  JOIN public.materials m ON m.id = eti.material_id
  WHERE eti.event_table_id = p_event_table_id
    AND (p_item_id IS NULL OR eti.id = p_item_id);
END;
$$;

-- 3.2 Explosão de necessidades com componentes
CREATE OR REPLACE FUNCTION public.explode_event_requirements(
  p_event_table_id uuid,
  p_explode_components boolean DEFAULT false
)
RETURNS TABLE(
  material_id uuid,
  material_name text,
  planned_qty numeric,
  planned_unit text,
  source_kind text,
  material_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
  recipe_record RECORD;
  component_record RECORD;
  event_attendees integer;
BEGIN
  -- Buscar número de participantes do evento
  SELECT attendees INTO event_attendees 
  FROM public.event_tables 
  WHERE id = p_event_table_id;
  
  -- Processar itens do evento
  FOR item_record IN 
    SELECT * FROM public.compute_event_item_planned_qty(p_event_table_id)
  LOOP
    -- Buscar dados do material
    SELECT mt.name, mt.material_type INTO recipe_record
    FROM public.materials mt 
    WHERE mt.id = item_record.material_id;
    
    -- Se é produto acabado e deve explodir componentes
    IF p_explode_components = true AND recipe_record.material_type = 'finished_product' THEN
      -- Buscar receita BOM
      SELECT rb.* INTO recipe_record
      FROM public.recipes_bom rb
      WHERE rb.finished_material_id = item_record.material_id;
      
      IF FOUND THEN
        -- Explodir componentes da receita
        FOR component_record IN
          SELECT 
            rbi.material_id as comp_material_id,
            m.name as comp_name,
            m.material_type as comp_type,
            rbi.quantity,
            rbi.unit,
            rbi.is_packaging
          FROM public.recipe_bom_items rbi
          JOIN public.materials m ON m.id = rbi.material_id
          WHERE rbi.recipe_id = recipe_record.id
        LOOP
          -- Calcular quantidade necessária do componente
          material_id := component_record.comp_material_id;
          material_name := component_record.comp_name;
          planned_qty := (item_record.planned_qty / NULLIF(recipe_record.yield_quantity, 0)) * component_record.quantity;
          planned_unit := component_record.unit;
          source_kind := CASE 
            WHEN component_record.is_packaging THEN 'packaging_component'
            ELSE 'recipe_component'
          END;
          material_type := component_record.comp_type;
          
          RETURN NEXT;
        END LOOP;
      ELSE
        -- Não tem receita, tratar como pick
        material_id := item_record.material_id;
        material_name := recipe_record.name;
        planned_qty := item_record.planned_qty;
        planned_unit := item_record.planned_unit;
        source_kind := 'pick_finished';
        material_type := recipe_record.material_type;
        
        RETURN NEXT;
      END IF;
    ELSE
      -- Não explodir ou não é produto acabado
      material_id := item_record.material_id;
      material_name := recipe_record.name;
      planned_qty := item_record.planned_qty;
      planned_unit := item_record.planned_unit;
      source_kind := CASE 
        WHEN recipe_record.material_type = 'finished_product' THEN 'produce_finished'
        WHEN recipe_record.material_type = 'resale_product' THEN 'pick_resale'
        ELSE 'pick_finished'
      END;
      material_type := recipe_record.material_type;
      
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 3.3 Geração de ordem de produção do evento
CREATE OR REPLACE FUNCTION public.generate_event_production(
  p_event_table_id uuid,
  p_target_table text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_code text;
  v_event_code text;
  requirement_record RECORD;
BEGIN
  -- Buscar código do evento
  SELECT event_code INTO v_event_code
  FROM public.event_tables
  WHERE id = p_event_table_id;
  
  -- Gerar código da ordem
  v_order_code := 'ORD-' || v_event_code || '-' || EXTRACT(EPOCH FROM now())::text;
  
  -- Criar ordem de produção
  INSERT INTO public.event_production_orders (
    event_table_id, order_code, status, notes
  ) VALUES (
    p_event_table_id, v_order_code, 'planned',
    'Ordem gerada automaticamente para evento ' || v_event_code
  ) RETURNING id INTO v_order_id;
  
  -- Inserir itens da ordem baseado nos requisitos
  FOR requirement_record IN
    SELECT DISTINCT 
      material_id, 
      SUM(planned_qty) as total_qty,
      planned_unit,
      source_kind
    FROM public.explode_event_requirements(p_event_table_id, false) -- Não explodir aqui
    GROUP BY material_id, planned_unit, source_kind
  LOOP
    INSERT INTO public.event_production_order_items (
      order_id, material_id, planned_qty, planned_unit, kind
    ) VALUES (
      v_order_id,
      requirement_record.material_id,
      requirement_record.total_qty,
      requirement_record.planned_unit,
      requirement_record.source_kind
    );
  END LOOP;
  
  RETURN v_order_id;
END;
$$;

-- 3.4 Execução da produção do evento
CREATE OR REPLACE FUNCTION public.execute_event_production(p_event_table_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  item_record RECORD;
BEGIN
  -- Buscar ordem do evento
  SELECT * INTO order_record
  FROM public.event_production_orders
  WHERE event_table_id = p_event_table_id
    AND status = 'planned'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma ordem planejada encontrada para o evento';
  END IF;
  
  -- Atualizar status da ordem
  UPDATE public.event_production_orders
  SET status = 'in_progress'
  WHERE id = order_record.id;
  
  -- Processar itens da ordem
  FOR item_record IN
    SELECT * FROM public.event_production_order_items
    WHERE order_id = order_record.id
  LOOP
    -- Executar conforme o tipo
    CASE item_record.kind
      WHEN 'produce_finished' THEN
        -- Chamar função de produção existente
        PERFORM public.produce_finished_product(
          item_record.material_id, 
          item_record.planned_qty
        );
        
      WHEN 'pick_resale', 'pick_finished' THEN
        -- Criar movimento de saída simples
        PERFORM public.process_component_consumption(
          item_record.material_id,
          item_record.planned_qty,
          item_record.planned_unit,
          'EVENT_PICK',
          p_event_table_id
        );
    END CASE;
  END LOOP;
  
  -- Finalizar ordem e evento
  UPDATE public.event_production_orders
  SET status = 'done'
  WHERE id = order_record.id;
  
  UPDATE public.event_tables
  SET status = 'done'
  WHERE id = p_event_table_id;
END;
$$;
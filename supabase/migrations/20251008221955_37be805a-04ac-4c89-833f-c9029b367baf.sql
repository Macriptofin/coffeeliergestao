
-- ================================================================================
-- CORREÇÃO: Função process_component_consumption com reference_type correto
-- ================================================================================

-- Corrigir função para usar 'Producao' ao invés de 'production'
-- e incluir reference_id no INSERT de stock_movements

CREATE OR REPLACE FUNCTION public.process_component_consumption(
    p_material_id uuid, 
    p_quantity numeric, 
    p_unit text, 
    p_movement_type text, 
    p_reference_material uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir que existe registro de estoque (UPSERT)
  INSERT INTO stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Saída de estoque
  UPDATE stock_items
     SET current_quantity = GREATEST(0, current_quantity - p_quantity),
         last_movement_date = now()
   WHERE material_id = p_material_id;

  -- CORRIGIDO: reference_type = 'Producao' (português) e adicionado reference_id
  INSERT INTO stock_movements (
    material_id, 
    movement_type, 
    quantity, 
    reference_type, 
    reference_id,
    notes, 
    movement_date
  ) VALUES (
    p_material_id, 
    'Saida', 
    p_quantity, 
    'Producao', 
    p_reference_material,
    CONCAT('Consumo para produção - Ref: ', p_reference_material), 
    now()
  );
END;
$$;

-- Corrigir também a função process_finish_input
CREATE OR REPLACE FUNCTION public.process_finish_input(
    p_material_id uuid, 
    p_quantity numeric, 
    p_movement_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir que existe registro de estoque (UPSERT)
  INSERT INTO stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Entrada de estoque
  UPDATE stock_items
     SET current_quantity = current_quantity + p_quantity,
         last_movement_date = now()
   WHERE material_id = p_material_id;

  -- CORRIGIDO: reference_type = 'Producao' (português)
  INSERT INTO stock_movements (
    material_id, 
    movement_type, 
    quantity, 
    reference_type, 
    notes, 
    movement_date
  ) VALUES (
    p_material_id, 
    'Entrada', 
    p_quantity, 
    'Producao', 
    'Entrada por produção', 
    now()
  );
END;
$$;

COMMENT ON FUNCTION public.process_component_consumption IS 
'Processa consumo de componentes na produção. 
CORREÇÃO: Usa reference_type = Producao (português) e inclui reference_id.';

COMMENT ON FUNCTION public.process_finish_input IS 
'Processa entrada de produtos acabados/intermediários após produção.
CORREÇÃO: Usa reference_type = Producao (português).';

-- ================================================================================
-- CORREÇÃO FINAL: Ajustar todas as funções de produção para usar valores corretos
-- ================================================================================

-- 1. Garantir que process_component_consumption use Saida (ao invés de movement_type passado)
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

  -- CRÍTICO: Usar movement_type='Saida' e reference_type='Producao'
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
    'Saida',  -- CORRIGIDO: sempre Saida para consumo
    p_quantity, 
    'Producao',  -- CORRIGIDO: valores aceitos pelo CHECK
    p_reference_material,
    CONCAT('Consumo para produção - Ref: ', p_reference_material), 
    now()
  );
END;
$$;

-- 2. Garantir que process_finish_input use Entrada
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

  -- CRÍTICO: Usar movement_type='Entrada' e reference_type='Producao'
  INSERT INTO stock_movements (
    material_id, 
    movement_type, 
    quantity, 
    reference_type, 
    notes, 
    movement_date
  ) VALUES (
    p_material_id, 
    'Entrada',  -- CORRIGIDO: sempre Entrada para produção
    p_quantity, 
    'Producao',  -- CORRIGIDO: valores aceitos pelo CHECK
    'Entrada por produção', 
    now()
  );
END;
$$;

-- 3. Adicionar comentários explicativos
COMMENT ON FUNCTION public.process_component_consumption IS 
'Processa consumo de componentes na produção. 
IMPORTANTE: Sempre usa movement_type=Saida e reference_type=Producao conforme CHECK constraint.';

COMMENT ON FUNCTION public.process_finish_input IS 
'Processa entrada de produtos acabados/intermediários após produção.
IMPORTANTE: Sempre usa movement_type=Entrada e reference_type=Producao conforme CHECK constraint.';
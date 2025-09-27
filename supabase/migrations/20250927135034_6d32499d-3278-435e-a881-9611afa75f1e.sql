-- Corrigir as funções de produção para usar valores corretos nos constraints

DROP FUNCTION IF EXISTS public.process_component_consumption(uuid, numeric, text, text, uuid);
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
  -- Saída de estoque
  UPDATE stock_items
     SET current_quantity = current_quantity - p_quantity,
         last_movement_date = now()
   WHERE material_id = p_material_id;

  INSERT INTO stock_movements (
    material_id, movement_type, quantity, reference_type, notes, movement_date
  ) VALUES (
    p_material_id, 'Saida', p_quantity, 'Producao', CONCAT('Consumo para produção - Ref: ', p_reference_material), now()
  );
END;
$$;

DROP FUNCTION IF EXISTS public.process_finish_input(uuid, numeric, text);
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
  -- Entrada de estoque (custo médio pode ser recalculado por rotina já existente, se aplicável)
  UPDATE stock_items
     SET current_quantity = current_quantity + p_quantity,
         last_movement_date = now()
   WHERE material_id = p_material_id;

  INSERT INTO stock_movements (
    material_id, movement_type, quantity, reference_type, notes, movement_date
  ) VALUES (
    p_material_id, 'Entrada', p_quantity, 'Producao', 'Entrada por produção', now()
  );
END;
$$;
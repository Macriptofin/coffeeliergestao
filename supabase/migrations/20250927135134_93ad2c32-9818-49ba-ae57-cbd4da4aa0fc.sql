-- Corrigir a função assemble_composite para usar valores corretos nos constraints

DROP FUNCTION IF EXISTS public.assemble_composite(uuid, numeric);
CREATE OR REPLACE FUNCTION public.assemble_composite(
    p_composite_material uuid, 
    p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_rec RECORD;
  req_qty numeric;
  c_item RECORD;
BEGIN
  SELECT * INTO c_rec FROM composites_bom WHERE composite_material_id = p_composite_material;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Composto não encontrado para material %', p_composite_material;
  END IF;

  FOR c_item IN
    SELECT ci.*, m.id AS mat_id
    FROM composite_bom_items ci
    JOIN materials m ON m.id = ci.component_material_id
    WHERE ci.composite_id = c_rec.id
  LOOP
    req_qty := p_qty * c_item.quantity;
    PERFORM process_component_consumption(c_item.mat_id, req_qty, c_item.unit, 'COMPOSITE_CONSUMPTION', p_composite_material);
  END LOOP;

  -- Se quiser controlar estoque do próprio composto montado, descomente:
  -- PERFORM process_finish_input(p_composite_material, p_qty, 'COMPOSITE_ASSEMBLED');
END;
$$;
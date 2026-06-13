-- Fix: physical_quantity era NOT NULL sem default, causando falha silenciosa
-- na rpc_inventory_add_materials ao criar ciclos de inventário.
-- A RPC tentava inserir NULL e o Postgres rejeitava → ciclo ficava sem materiais.

ALTER TABLE public.inventory_adjustments
  ALTER COLUMN physical_quantity DROP NOT NULL;

-- Recriar rpc_inventory_add_materials com INSERT correto
CREATE OR REPLACE FUNCTION public.rpc_inventory_add_materials(
  p_cycle_id UUID,
  p_material_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_current_qty NUMERIC;
  v_added_count INTEGER := 0;
BEGIN
  FOREACH v_material_id IN ARRAY p_material_ids
  LOOP
    IF EXISTS (
      SELECT 1 FROM inventory_adjustments
      WHERE cycle_id = p_cycle_id AND material_id = v_material_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(current_quantity, 0) INTO v_current_qty
    FROM stock_items WHERE material_id = v_material_id;

    v_current_qty := COALESCE(v_current_qty, 0);

    INSERT INTO inventory_adjustments (
      cycle_id,
      material_id,
      system_quantity,
      physical_quantity,
      adjustment_reason,
      is_draft,
      responsible_user_id
    ) VALUES (
      p_cycle_id,
      v_material_id,
      v_current_qty,
      NULL,
      'Contagem de inventário',
      TRUE,
      auth.uid()
    );

    v_added_count := v_added_count + 1;
  END LOOP;

  RETURN v_added_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inventory_add_materials TO authenticated;

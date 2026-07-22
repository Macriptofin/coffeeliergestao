-- trg_sync_stock_quantity dispara em INSERT OR DELETE OR UPDATE, mas a função só lia NEW —
-- em DELETE, NEW é nulo, gerando INSERT INTO stock_items com material_id nulo (viola NOT NULL)
-- e derrubando qualquer exclusão de stock_movements (ex.: reverter NF já lançada).
CREATE OR REPLACE FUNCTION public.trigger_sync_stock_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_qty NUMERIC;
  v_material_id UUID;
  v_movement_type TEXT;
  v_movement_date TIMESTAMPTZ;
  v_unit_price NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_material_id := OLD.material_id;
    v_movement_type := OLD.movement_type;
    v_movement_date := OLD.movement_date;
    v_unit_price := OLD.unit_price;
  ELSE
    v_material_id := NEW.material_id;
    v_movement_type := NEW.movement_type;
    v_movement_date := NEW.movement_date;
    v_unit_price := NEW.unit_price;
  END IF;

  -- Movimentos de Ajuste: quantidade já definida diretamente em stock_items.
  -- Apenas registramos o histórico sem recalcular.
  IF v_movement_type = 'Ajuste' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Para demais movimentos, recalcular a partir de todas as movimentações
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução')
      THEN quantity
      WHEN movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda')
      THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_current_qty
  FROM stock_movements
  WHERE material_id = v_material_id;

  INSERT INTO stock_items (
    material_id,
    current_quantity,
    average_price,
    total_value,
    last_movement_date,
    updated_at
  ) VALUES (
    v_material_id,
    v_current_qty,
    COALESCE(v_unit_price, 0),
    v_current_qty * COALESCE(v_unit_price, 0),
    v_movement_date,
    now()
  )
  ON CONFLICT (material_id) DO UPDATE SET
    current_quantity   = v_current_qty,
    total_value        = CASE
                           WHEN stock_items.average_price > 0
                           THEN v_current_qty * stock_items.average_price
                           ELSE stock_items.total_value
                         END,
    last_movement_date = v_movement_date,
    updated_at         = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- trigger_sync_stock_quantity recalculava current_quantity do ZERO somando todo o
-- histórico de stock_movements a cada INSERT/UPDATE/DELETE. Isso ignora que 'Ajuste'
-- (process_inventory_adjustment) define o saldo diretamente em stock_items — o
-- recálculo do zero descarta silenciosamente esse ajuste assim que QUALQUER movimento
-- normal (compra/consumo) acontece depois. Achado real: 13 materiais afetados hoje
-- (Ovo, Água Mineral sem Gás, etc.), com saldo negativo incorreto.
--
-- Corrige pra incremental: soma/subtrai apenas o delta do movimento atual em cima do
-- saldo já existente, em vez de reconstruir tudo do zero. Isso nunca mais apaga um ajuste.
CREATE OR REPLACE FUNCTION public.trigger_sync_stock_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_material_id UUID;
  v_delta NUMERIC := 0;
  v_movement_date TIMESTAMPTZ;
  v_unit_price NUMERIC;
  v_is_ajuste BOOLEAN;
BEGIN
  v_is_ajuste := (CASE WHEN TG_OP = 'DELETE' THEN OLD.movement_type ELSE NEW.movement_type END) = 'Ajuste';

  -- Movimentos de Ajuste: quantidade já definida diretamente em stock_items pelo
  -- RPC de ajuste (process_inventory_adjustment). Aqui só registramos o histórico.
  IF v_is_ajuste THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_material_id := NEW.material_id;
    v_movement_date := NEW.movement_date;
    v_unit_price := NEW.unit_price;
    v_delta := CASE
      WHEN NEW.movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução') THEN NEW.quantity
      WHEN NEW.movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda') THEN -NEW.quantity
      ELSE 0
    END;
  ELSIF TG_OP = 'DELETE' THEN
    v_material_id := OLD.material_id;
    v_unit_price := NULL;
    v_delta := -1 * (CASE
      WHEN OLD.movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução') THEN OLD.quantity
      WHEN OLD.movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda') THEN -OLD.quantity
      ELSE 0
    END);
  ELSE -- UPDATE
    v_material_id := NEW.material_id;
    v_movement_date := NEW.movement_date;
    v_unit_price := NEW.unit_price;
    v_delta := (CASE
      WHEN NEW.movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução') THEN NEW.quantity
      WHEN NEW.movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda') THEN -NEW.quantity
      ELSE 0
    END) - (CASE
      WHEN OLD.movement_type IN ('Entrada', 'Compra', 'Entrada NF', 'Entrada Produção', 'Ajuste Positivo', 'Devolução') THEN OLD.quantity
      WHEN OLD.movement_type IN ('Saída', 'Consumo', 'Consumo Produção', 'Ajuste Negativo', 'Perda') THEN -OLD.quantity
      ELSE 0
    END);
  END IF;

  INSERT INTO stock_items (
    material_id,
    current_quantity,
    average_price,
    total_value,
    last_movement_date,
    updated_at
  ) VALUES (
    v_material_id,
    v_delta,
    COALESCE(v_unit_price, 0),
    v_delta * COALESCE(v_unit_price, 0),
    v_movement_date,
    now()
  )
  ON CONFLICT (material_id) DO UPDATE SET
    current_quantity   = stock_items.current_quantity + v_delta,
    total_value        = CASE
                           WHEN stock_items.average_price > 0
                           THEN (stock_items.current_quantity + v_delta) * stock_items.average_price
                           ELSE stock_items.total_value
                         END,
    last_movement_date = CASE WHEN TG_OP = 'DELETE' THEN stock_items.last_movement_date ELSE v_movement_date END,
    updated_at         = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$;

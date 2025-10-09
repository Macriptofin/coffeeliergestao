-- Ajuste referência de movimentos de estoque para ordens de produção (BOM)
-- 1) Ampliar CHECK constraint para permitir 'ProducaoOrdem'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stock_movements_reference_type_check'
      AND table_name = 'stock_movements'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.stock_movements
      DROP CONSTRAINT stock_movements_reference_type_check;
  END IF;
END $$;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_reference_type_check
  CHECK (reference_type IN ('Compra', 'Producao', 'Ajuste', 'Perda', 'ProducaoOrdem'));

-- 2) Atualizar função de validação para cobrir 'ProducaoOrdem' (ordem BOM)
CREATE OR REPLACE FUNCTION public.validate_stock_movement_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar que reference_id aponta para recipes_bom quando reference_type = 'Producao'
  IF NEW.reference_type = 'Producao' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.recipes_bom WHERE id = NEW.reference_id
    ) THEN
      RAISE EXCEPTION 'reference_id inválido para Producao: não existe recipes_bom com id %', NEW.reference_id;
    END IF;
  ELSIF NEW.reference_type = 'ProducaoOrdem' THEN
    -- Validar que reference_id aponta para bom_production_orders quando reference_type = 'ProducaoOrdem'
    IF NOT EXISTS (
      SELECT 1 FROM public.bom_production_orders WHERE id = NEW.reference_id
    ) THEN
      RAISE EXCEPTION 'reference_id inválido para ProducaoOrdem: não existe bom_production_orders com id %', NEW.reference_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recriar trigger para garantir que usa a função atualizada
DROP TRIGGER IF EXISTS trg_validate_stock_movement_reference ON public.stock_movements;
CREATE TRIGGER trg_validate_stock_movement_reference
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_movement_reference();

-- 3) Funções específicas para ordens BOM (evitar confusão com receitas_bom)
-- 3.1) Consumo de componentes vinculado à ordem de produção BOM
CREATE OR REPLACE FUNCTION public.process_order_component_consumption(
    p_material_id uuid,
    p_quantity numeric,
    p_unit text,
    p_production_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir existência de stock_items
  INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM public.materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Saída de estoque
  UPDATE public.stock_items
     SET current_quantity = GREATEST(0, current_quantity - p_quantity),
         last_movement_date = now(),
         updated_at = now()
   WHERE material_id = p_material_id;

  -- Registrar movimento padrão com referência à ordem BOM
  INSERT INTO public.stock_movements (
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
    'ProducaoOrdem',
    p_production_order_id,
    CONCAT('Consumo para ordem de produção BOM: ', p_production_order_id),
    now()
  );
END;
$$;

COMMENT ON FUNCTION public.process_order_component_consumption IS 
'Consome componentes para ordens de produção BOM. Registra stock_movements com reference_type=ProducaoOrdem.';

-- 3.2) Entrada do produto acabado/intermediário vinculada à ordem de produção BOM
CREATE OR REPLACE FUNCTION public.process_order_finish_input(
    p_material_id uuid,
    p_quantity numeric,
    p_production_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir existência de stock_items
  INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM public.materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Entrada de estoque (cálculo de custo pode ser tratado em função dedicada)
  UPDATE public.stock_items
     SET current_quantity = current_quantity + p_quantity,
         last_movement_date = now(),
         updated_at = now()
   WHERE material_id = p_material_id;

  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    movement_date
  ) VALUES (
    p_material_id,
    'Entrada',
    p_quantity,
    'ProducaoOrdem',
    p_production_order_id,
    'Entrada por ordem de produção BOM',
    now()
  );
END;
$$;

COMMENT ON FUNCTION public.process_order_finish_input IS 
'Entrada de produtos produzidos para ordens BOM. Registra stock_movements com reference_type=ProducaoOrdem.';

-- 4) Atualizar o fluxo de ordens para usar as novas funções
-- 4.1) Consumo
CREATE OR REPLACE FUNCTION public.consume_materials_for_production(p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  material_record RECORD;
BEGIN
  FOR material_record IN
    SELECT * FROM public.bom_production_consolidated_materials
    WHERE production_order_id = p_production_order_id
      AND is_reserved = true AND is_consumed = false
  LOOP
    -- Usar função específica de ordem
    PERFORM public.process_order_component_consumption(
      material_record.material_id,
      material_record.total_quantity,
      material_record.unit,
      p_production_order_id
    );

    -- Registrar também em tabela de movimentos da ordem (já existia)
    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, material_record.material_id, 'consume', 
      material_record.total_quantity, material_record.unit, 
      'Consumo automático para produção', auth.uid()
    );

    UPDATE public.bom_production_consolidated_materials
    SET is_consumed = true, consumed_quantity = total_quantity
    WHERE id = material_record.id;
  END LOOP;
END;
$$;

-- 4.2) Entrada de produzidos
CREATE OR REPLACE FUNCTION public.produce_finished_products_for_order(p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_record RECORD;
  bom_record RECORD;
BEGIN
  FOR item_record IN
    SELECT * FROM public.bom_production_order_items
    WHERE production_order_id = p_production_order_id
  LOOP
    SELECT rb.*, m.* INTO bom_record
    FROM public.recipes_bom rb
    JOIN public.materials m ON m.id = rb.finished_material_id
    WHERE rb.id = item_record.bom_id;

    -- Usar função específica de ordem
    PERFORM public.process_order_finish_input(
      bom_record.finished_material_id,
      item_record.total_yield_quantity,
      p_production_order_id
    );

    INSERT INTO public.bom_production_stock_movements (
      production_order_id, material_id, movement_type, quantity, unit, notes, created_by
    ) VALUES (
      p_production_order_id, bom_record.finished_material_id, 'produce', 
      item_record.total_yield_quantity, item_record.yield_unit, 
      'Produção de ' || bom_record.name, auth.uid()
    );
  END LOOP;
END;
$$;
-- ================================================================================
-- CORREÇÃO CRÍTICA: Sistema de Custos de Produção
-- ================================================================================
-- Backup automático antes da limpeza
-- Correção da função produce_finished_product
-- Limpeza de dados incorretos
-- Trigger de validação
-- ================================================================================

-- 1. BACKUP: Criar tabelas de backup antes de deletar
CREATE TABLE IF NOT EXISTS backup.stock_movements_before_fix AS 
SELECT * FROM public.stock_movements 
WHERE reference_type = 'Producao';

CREATE TABLE IF NOT EXISTS backup.stock_items_before_fix AS
SELECT si.* 
FROM public.stock_items si
JOIN public.materials m ON m.id = si.material_id
WHERE m.material_type = 'intermediate_product';

-- 2. CORRIGIR FUNÇÃO produce_finished_product
CREATE OR REPLACE FUNCTION public.produce_finished_product(p_material_id uuid, p_quantity numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_material RECORD;
  v_bom RECORD;
  v_bom_item RECORD;
  v_required_qty numeric;
  v_available_qty numeric;
  v_total_cost numeric := 0;
  v_unit_cost numeric;
  v_produced_qty numeric;
  v_current_stock numeric;
  v_current_avg_price numeric;
  v_new_avg_price numeric;
  v_result jsonb;
BEGIN
  -- 1. Validar material
  SELECT * INTO v_material
  FROM public.materials
  WHERE id = p_material_id
    AND material_type IN ('finished_product', 'intermediate_product');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material inválido ou não é produto acabado/intermediário');
  END IF;

  -- 2. Buscar BOM
  SELECT * INTO v_bom
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id
    AND is_archived = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'BOM não encontrada para este material');
  END IF;

  -- 3. Validar estoque de ingredientes
  FOR v_bom_item IN
    SELECT rbi.*, m.name
    FROM public.recipe_bom_items rbi
    JOIN public.materials m ON m.id = rbi.material_id
    WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    SELECT current_quantity INTO v_available_qty
    FROM public.stock_items
    WHERE material_id = v_bom_item.material_id;

    IF v_available_qty IS NULL OR v_available_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Estoque insuficiente: %s (necessário: %s, disponível: %s)',
          v_bom_item.name, v_required_qty, COALESCE(v_available_qty, 0))
      );
    END IF;
  END LOOP;

  -- 4. Consumir ingredientes e calcular custo total
  FOR v_bom_item IN
    SELECT rbi.*, si.average_price
    FROM public.recipe_bom_items rbi
    JOIN public.stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = v_bom.id
  LOOP
    v_required_qty := v_bom_item.quantity * p_quantity;

    -- Baixar do estoque
    UPDATE public.stock_items
    SET current_quantity = current_quantity - v_required_qty,
        total_value = (current_quantity - v_required_qty) * average_price,
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = v_bom_item.material_id;

    -- CORRIGIDO: Usar recipe_id ao invés de bom_id
    INSERT INTO public.stock_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_cost,
      reference_type,
      reference_id
    ) VALUES (
      v_bom_item.material_id,
      'Consumo Produção',
      v_required_qty,
      v_bom_item.average_price,
      v_required_qty * v_bom_item.average_price,
      'Producao',
      v_bom.id
    );

    -- Acumular custo
    v_total_cost := v_total_cost + (v_required_qty * v_bom_item.average_price);
  END LOOP;

  -- 5. Calcular quantidade produzida e custo unitário
  v_produced_qty := v_bom.yield_quantity * p_quantity;
  v_unit_cost := v_total_cost / v_produced_qty;

  -- 6. Buscar estoque atual do produto acabado
  SELECT current_quantity, average_price
  INTO v_current_stock, v_current_avg_price
  FROM public.stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;

  -- 7. Calcular novo preço médio ponderado
  IF v_current_stock IS NULL OR v_current_stock = 0 THEN
    v_new_avg_price := v_unit_cost;

    INSERT INTO public.stock_items (
      material_id,
      current_quantity,
      average_price,
      total_value,
      cost_source,
      manual_price,
      cost_last_updated_at,
      cost_last_updated_by
    ) VALUES (
      p_material_id,
      v_produced_qty,
      v_new_avg_price,
      v_produced_qty * v_new_avg_price,
      'production',
      false,
      now(),
      auth.uid()
    );
  ELSE
    v_new_avg_price := (
      (v_current_stock * v_current_avg_price) + (v_produced_qty * v_unit_cost)
    ) / (v_current_stock + v_produced_qty);

    UPDATE public.stock_items
    SET current_quantity = v_current_stock + v_produced_qty,
        average_price = v_new_avg_price,
        total_value = (v_current_stock + v_produced_qty) * v_new_avg_price,
        cost_source = 'production',
        cost_last_updated_at = now(),
        cost_last_updated_by = auth.uid(),
        last_movement_date = now(),
        updated_at = now()
    WHERE material_id = p_material_id;
  END IF;

  -- 8. CORRIGIDO: Usar recipe_id ao invés de bom_id
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_cost,
    reference_type,
    reference_id
  ) VALUES (
    p_material_id,
    'Entrada Produção',
    v_produced_qty,
    v_unit_cost,
    v_total_cost,
    'Producao',
    v_bom.id
  );

  -- 9. Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'material_id', p_material_id,
    'produced_quantity', v_produced_qty,
    'unit_cost', v_unit_cost,
    'total_cost', v_total_cost,
    'new_avg_price', v_new_avg_price,
    'cost_source', 'production'
  );
END;
$function$;

-- 3. LIMPEZA: Remover dados incorretos de TODOS os produtos intermediários
-- Deletar movimentações incorretas
DELETE FROM public.stock_movements
WHERE reference_type = 'Producao'
  AND material_id IN (
    SELECT id FROM public.materials 
    WHERE material_type = 'intermediate_product'
  );

-- Resetar stock_items de produtos intermediários
UPDATE public.stock_items
SET current_quantity = 0,
    average_price = 0,
    total_value = 0,
    cost_source = 'manual',
    cost_last_updated_at = now()
WHERE material_id IN (
  SELECT id FROM public.materials 
  WHERE material_type = 'intermediate_product'
);

-- 4. TRIGGER DE VALIDAÇÃO: Prevenir inserts incorretos
CREATE OR REPLACE FUNCTION public.validate_stock_movement_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que reference_id aponta para recipes_bom quando reference_type = 'Producao'
  IF NEW.reference_type = 'Producao' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.recipes_bom WHERE id = NEW.reference_id
    ) THEN
      RAISE EXCEPTION 'reference_id inválido: não existe recipes_bom com id %', NEW.reference_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stock_movement_reference ON public.stock_movements;
CREATE TRIGGER trg_validate_stock_movement_reference
  BEFORE INSERT OR UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_movement_reference();

-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
COMMENT ON FUNCTION public.produce_finished_product IS 
'Produz produtos acabados/intermediários consumindo ingredientes do estoque. 
CORREÇÃO APLICADA: Usa recipe_id (recipes_bom.id) ao invés de bom_id inexistente.
VALIDAÇÃO: Trigger garante integridade referencial.';

COMMENT ON TRIGGER trg_validate_stock_movement_reference ON public.stock_movements IS
'Valida que movimentações de produção referenciam recipes_bom válidos.';

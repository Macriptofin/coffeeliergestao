-- Fase 2: Implementação de Cache e Triggers de Atualização
-- Adicionar campos de cache nas tabelas de BOM

-- 1. Adicionar campos de cache em recipes_bom
ALTER TABLE recipes_bom 
ADD COLUMN IF NOT EXISTS cached_total_cost NUMERIC(14, 4),
ADD COLUMN IF NOT EXISTS cached_unit_cost NUMERIC(14, 4),
ADD COLUMN IF NOT EXISTS cost_last_calculated_at TIMESTAMPTZ;

-- 2. Adicionar campos de cache em composites_bom
ALTER TABLE composites_bom 
ADD COLUMN IF NOT EXISTS cached_total_cost NUMERIC(14, 4),
ADD COLUMN IF NOT EXISTS cost_last_calculated_at TIMESTAMPTZ;

-- 3. Criar função para recalcular custos de BOMs que usam um material específico
CREATE OR REPLACE FUNCTION refresh_bom_costs_for_material(p_material_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_recipe_boms INTEGER := 0;
  v_affected_composite_boms INTEGER := 0;
  v_result jsonb;
BEGIN
  -- Atualizar custos de recipes_bom que usam este material
  WITH updated_recipes AS (
    UPDATE recipes_bom rb
    SET 
      cached_total_cost = (
        SELECT SUM(
          rbi.quantity * 
          COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
        )
        FROM recipe_bom_items rbi
        JOIN materials m ON m.id = rbi.material_id
        LEFT JOIN stock_items si ON si.material_id = rbi.material_id
        WHERE rbi.recipe_id = rb.id
      ),
      cached_unit_cost = (
        SELECT 
          SUM(
            rbi.quantity * 
            COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
          ) / NULLIF(rb.yield_quantity, 0)
        FROM recipe_bom_items rbi
        JOIN materials m ON m.id = rbi.material_id
        LEFT JOIN stock_items si ON si.material_id = rbi.material_id
        WHERE rbi.recipe_id = rb.id
      ),
      cost_last_calculated_at = NOW()
    WHERE rb.id IN (
      SELECT DISTINCT rbi.recipe_id
      FROM recipe_bom_items rbi
      WHERE rbi.material_id = p_material_id
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_affected_recipe_boms FROM updated_recipes;

  -- Atualizar custos de composites_bom que usam este material
  WITH updated_composites AS (
    UPDATE composites_bom cb
    SET 
      cached_total_cost = (
        SELECT SUM(
          cbi.quantity * 
          COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
        )
        FROM composite_bom_items cbi
        JOIN materials m ON m.id = cbi.component_material_id
        LEFT JOIN stock_items si ON si.material_id = cbi.component_material_id
        WHERE cbi.composite_id = cb.id
      ),
      cost_last_calculated_at = NOW()
    WHERE cb.id IN (
      SELECT DISTINCT cbi.composite_id
      FROM composite_bom_items cbi
      WHERE cbi.component_material_id = p_material_id
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_affected_composite_boms FROM updated_composites;

  v_result := jsonb_build_object(
    'material_id', p_material_id,
    'affected_recipe_boms', v_affected_recipe_boms,
    'affected_composite_boms', v_affected_composite_boms,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- 4. Criar trigger para atualização automática quando average_price muda
CREATE OR REPLACE FUNCTION trigger_refresh_bom_costs_on_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só recalcular se o average_price realmente mudou
  IF TG_OP = 'UPDATE' AND OLD.average_price IS DISTINCT FROM NEW.average_price THEN
    -- Chamar função de recálculo de forma assíncrona (não bloqueia a transação)
    PERFORM refresh_bom_costs_for_material(NEW.material_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Criar trigger para atualização automática quando price_per_purchase_unit muda
CREATE OR REPLACE FUNCTION trigger_refresh_bom_costs_on_material_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só recalcular se o preço realmente mudou
  IF TG_OP = 'UPDATE' AND OLD.price_per_purchase_unit IS DISTINCT FROM NEW.price_per_purchase_unit THEN
    -- Chamar função de recálculo de forma assíncrona
    PERFORM refresh_bom_costs_for_material(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Aplicar triggers nas tabelas
DROP TRIGGER IF EXISTS update_bom_costs_on_stock_change ON stock_items;
CREATE TRIGGER update_bom_costs_on_stock_change
  AFTER UPDATE ON stock_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_bom_costs_on_stock_change();

DROP TRIGGER IF EXISTS update_bom_costs_on_material_price_change ON materials;
CREATE TRIGGER update_bom_costs_on_material_price_change
  AFTER UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_bom_costs_on_material_price_change();

-- 7. Criar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_material_id 
  ON recipe_bom_items(material_id);
  
CREATE INDEX IF NOT EXISTS idx_composite_bom_items_component_material_id 
  ON composite_bom_items(component_material_id);

CREATE INDEX IF NOT EXISTS idx_stock_items_average_price 
  ON stock_items(average_price) WHERE average_price IS NOT NULL;

-- 8. Inicializar cache para BOMs existentes
-- Calcular custos iniciais para recipes_bom
UPDATE recipes_bom rb
SET 
  cached_total_cost = (
    SELECT SUM(
      rbi.quantity * 
      COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
    )
    FROM recipe_bom_items rbi
    JOIN materials m ON m.id = rbi.material_id
    LEFT JOIN stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = rb.id
  ),
  cached_unit_cost = (
    SELECT 
      SUM(
        rbi.quantity * 
        COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
      ) / NULLIF(rb.yield_quantity, 0)
    FROM recipe_bom_items rbi
    JOIN materials m ON m.id = rbi.material_id
    LEFT JOIN stock_items si ON si.material_id = rbi.material_id
    WHERE rbi.recipe_id = rb.id
  ),
  cost_last_calculated_at = NOW()
WHERE cached_total_cost IS NULL;

-- Calcular custos iniciais para composites_bom
UPDATE composites_bom cb
SET 
  cached_total_cost = (
    SELECT SUM(
      cbi.quantity * 
      COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
    )
    FROM composite_bom_items cbi
    JOIN materials m ON m.id = cbi.component_material_id
    LEFT JOIN stock_items si ON si.material_id = cbi.component_material_id
    WHERE cbi.composite_id = cb.id
  ),
  cost_last_calculated_at = NOW()
WHERE cached_total_cost IS NULL;

-- Comentários finais
COMMENT ON COLUMN recipes_bom.cached_total_cost IS 'Custo total cacheado da receita, atualizado automaticamente quando preços mudam';
COMMENT ON COLUMN recipes_bom.cached_unit_cost IS 'Custo unitário cacheado (custo total / rendimento), atualizado automaticamente';
COMMENT ON COLUMN recipes_bom.cost_last_calculated_at IS 'Data/hora da última atualização dos custos cacheados';
COMMENT ON COLUMN composites_bom.cached_total_cost IS 'Custo total cacheado do composto, atualizado automaticamente quando preços mudam';
COMMENT ON COLUMN composites_bom.cost_last_calculated_at IS 'Data/hora da última atualização dos custos cacheados';
COMMENT ON FUNCTION refresh_bom_costs_for_material IS 'Recalcula custos de todas as BOMs que utilizam um material específico';
COMMENT ON FUNCTION trigger_refresh_bom_costs_on_stock_change IS 'Trigger que recalcula custos quando average_price de stock_items muda';
COMMENT ON FUNCTION trigger_refresh_bom_costs_on_material_price_change IS 'Trigger que recalcula custos quando price_per_purchase_unit de materials muda';
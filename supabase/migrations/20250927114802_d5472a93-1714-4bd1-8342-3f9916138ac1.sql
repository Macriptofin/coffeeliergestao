-- [Doc] Migração - Parte 3: Views, Funções e Índices de Performance

-- View de custo padrão para produto acabado (BOM)
CREATE OR REPLACE VIEW v_finished_product_cost AS
SELECT
  r.finished_material_id AS material_id,
  r.yield_quantity,
  r.yield_unit,
  SUM(
    ri.quantity
    * COALESCE(
        si.average_price / NULLIF(m.conversion_factor, 0),   -- custo por unidade de uso vindo do estoque
        m.price_per_purchase_unit / NULLIF(m.conversion_factor, 0) -- fallback: preço do cadastro
      )
  ) AS standard_cost_per_yield
FROM recipes_bom r
JOIN recipe_bom_items ri ON ri.recipe_id = r.id
JOIN materials m ON m.id = ri.material_id
LEFT JOIN stock_items si ON si.material_id = m.id
GROUP BY r.finished_material_id, r.yield_quantity, r.yield_unit;

-- Funções utilitárias para movimentar estoque
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_component_consumption') THEN
    CREATE OR REPLACE FUNCTION process_component_consumption(
      p_material_id uuid,
      p_quantity    numeric,
      p_unit        text,
      p_movement_type text,        -- 'PRODUCTION_CONSUMPTION' | 'COMPOSITE_CONSUMPTION'
      p_reference_material uuid    -- material pai (acabado/composto)
    )
    RETURNS void 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    BEGIN
      -- Saída de estoque
      UPDATE stock_items
         SET current_quantity = current_quantity - p_quantity,
             last_movement_date = now()
       WHERE material_id = p_material_id;

      INSERT INTO stock_movements (
        material_id, movement_type, quantity, reference_type, notes, movement_date
      ) VALUES (
        p_material_id, p_movement_type, p_quantity, 'material', CONCAT('Ref: ', p_reference_material), now()
      );
    END;
    $f$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_finish_input') THEN
    CREATE OR REPLACE FUNCTION process_finish_input(
      p_material_id uuid,
      p_quantity    numeric,
      p_movement_type text       -- 'PRODUCTION_INPUT' | 'COMPOSITE_ASSEMBLED'
    )
    RETURNS void 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    BEGIN
      -- Entrada de estoque (custo médio pode ser recalculado por rotina já existente, se aplicável)
      UPDATE stock_items
         SET current_quantity = current_quantity + p_quantity,
             last_movement_date = now()
       WHERE material_id = p_material_id;

      INSERT INTO stock_movements (
        material_id, movement_type, quantity, reference_type, notes, movement_date
      ) VALUES (
        p_material_id, p_movement_type, p_quantity, 'material', NULL, now()
      );
    END;
    $f$;
  END IF;
END$$;

-- Função de produção (baixa insumos+embalagens da receita e dá entrada do acabado)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'produce_finished_product') THEN
    CREATE OR REPLACE FUNCTION produce_finished_product(
      p_finished_material uuid,
      p_output_qty       numeric
    )
    RETURNS void 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE
      r_rec RECORD;
      req_qty numeric;
      comp RECORD;
    BEGIN
      SELECT * INTO r_rec FROM recipes_bom WHERE finished_material_id = p_finished_material;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Receita não encontrada para material %', p_finished_material;
      END IF;

      -- Consome componentes (inclui embalagens se estiverem na receita)
      FOR comp IN
        SELECT ri.*, m.id AS mat_id
        FROM recipe_bom_items ri
        JOIN materials m ON m.id = ri.material_id
        WHERE ri.recipe_id = r_rec.id
      LOOP
        req_qty := (p_output_qty / r_rec.yield_quantity) * comp.quantity;
        PERFORM process_component_consumption(comp.mat_id, req_qty, comp.unit, 'PRODUCTION_CONSUMPTION', p_finished_material);
      END LOOP;

      -- Entrada do produto acabado
      PERFORM process_finish_input(p_finished_material, p_output_qty, 'PRODUCTION_INPUT');
    END;
    $f$;
  END IF;
END$$;

-- Função de montagem de composto (baixa os componentes do kit/mesa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assemble_composite') THEN
    CREATE OR REPLACE FUNCTION assemble_composite(
      p_composite_material uuid,
      p_qty               numeric
    )
    RETURNS void 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
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
    $f$;
  END IF;
END$$;

-- Triggers de validação para material_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_material_type_bom') THEN
    CREATE OR REPLACE FUNCTION validate_material_type_bom()
    RETURNS trigger 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE
      mat_type text;
    BEGIN
      IF TG_TABLE_NAME = 'recipes_bom' THEN
        SELECT material_type INTO mat_type 
        FROM materials WHERE id = NEW.finished_material_id;
        IF mat_type != 'finished_product' THEN
          RAISE EXCEPTION 'Material deve ser do tipo finished_product para ter receita';
        END IF;
      ELSIF TG_TABLE_NAME = 'composites_bom' THEN
        SELECT material_type INTO mat_type 
        FROM materials WHERE id = NEW.composite_material_id;
        IF mat_type != 'composite_product' THEN
          RAISE EXCEPTION 'Material deve ser do tipo composite_product para ter composição';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $f$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'recipes_bom_validate_material_type_trg') THEN
    CREATE TRIGGER recipes_bom_validate_material_type_trg
    BEFORE INSERT OR UPDATE ON recipes_bom
    FOR EACH ROW EXECUTE FUNCTION validate_material_type_bom();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'composites_bom_validate_material_type_trg') THEN
    CREATE TRIGGER composites_bom_validate_material_type_trg
    BEFORE INSERT OR UPDATE ON composites_bom
    FOR EACH ROW EXECUTE FUNCTION validate_material_type_bom();
  END IF;
END$$;

-- Índices de apoio em estoque (performance)
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_date
  ON stock_movements(material_id, movement_date);

CREATE INDEX IF NOT EXISTS idx_stock_items_material
  ON stock_items(material_id);
-- ========================================
-- SUPORTE A PRODUTOS INTERMEDIÁRIOS (RECEITAS-BASE) - VERSÃO SIMPLIFICADA
-- ========================================

-- 1. EXTENSÃO DO TIPO MATERIAL_TYPE
DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_material_type_check;
  
  -- Adicionar nova constraint incluindo intermediate_product
  ALTER TABLE materials ADD CONSTRAINT materials_material_type_check 
    CHECK (material_type IN (
      'ingredient', 
      'packaging', 
      'resale_product', 
      'finished_product', 
      'composite_product', 
      'intermediate_product'
    ));
  
  RAISE INFO 'Material type extended: +intermediate_product';
END $$;

-- 2. ADICIONAR COLUNA IS_SELLABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'is_sellable'
  ) THEN
    ALTER TABLE materials ADD COLUMN is_sellable BOOLEAN DEFAULT false;
    
    -- Definir valores padrão baseados no material_type existente
    UPDATE materials SET is_sellable = true WHERE material_type = 'finished_product';
    UPDATE materials SET is_sellable = false WHERE material_type IN ('intermediate_product', 'ingredient', 'packaging');
    
    RAISE INFO 'Added is_sellable column with appropriate defaults';
  END IF;
END $$;

-- 3. FUNÇÃO GENÉRICA DE PRODUÇÃO
CREATE OR REPLACE FUNCTION public.produce_product(p_material_id uuid, p_output_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material_record RECORD;
  recipe_record RECORD;
  component_record RECORD;
  req_qty numeric;
BEGIN
  -- Verificar tipo do material
  SELECT material_type, name INTO material_record 
  FROM materials 
  WHERE id = p_material_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material não encontrado: %', p_material_id;
  END IF;
  
  -- Se for finished_product ou intermediate_product, processar receita
  IF material_record.material_type IN ('finished_product', 'intermediate_product') THEN
    
    -- Buscar receita BOM
    SELECT * INTO recipe_record
    FROM recipes_bom 
    WHERE finished_material_id = p_material_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Receita BOM não encontrada para material %', material_record.name;
    END IF;
    
    -- Consumir componentes
    FOR component_record IN
      SELECT 
        rbi.material_id,
        rbi.quantity,
        rbi.unit,
        COALESCE(rbi.is_packaging, false) as is_packaging,
        m.name as component_name
      FROM recipe_bom_items rbi
      JOIN materials m ON m.id = rbi.material_id
      WHERE rbi.recipe_id = recipe_record.id
    LOOP
      -- Calcular quantidade necessária
      req_qty := (p_output_qty / NULLIF(recipe_record.yield_quantity, 0)) * component_record.quantity;
      
      -- Processar consumo
      PERFORM process_component_consumption(
        component_record.material_id, 
        req_qty, 
        component_record.unit, 
        'PRODUCTION_CONSUMPTION', 
        p_material_id
      );
    END LOOP;
    
    -- Entrada do produto produzido
    PERFORM process_finish_input(p_material_id, p_output_qty, 'PRODUCTION_INPUT');
    
  ELSE
    RAISE EXCEPTION 'Material % não pode ser produzido. Tipo: %', material_record.name, material_record.material_type;
  END IF;
END;
$$;

-- 4. VIEW DE CUSTO DE PRODUTOS (incluindo intermediários)
CREATE OR REPLACE VIEW public.v_product_cost AS
SELECT 
  m.id,
  m.name,
  m.code,
  m.material_type,
  m.category,
  m.is_sellable,
  -- Custo unitário: prioriza stock_items.average_price, fallback price_per_purchase_unit/conversion_factor
  COALESCE(
    si.average_price,
    m.price_per_purchase_unit / NULLIF(m.conversion_factor, 0)
  ) as unit_cost,
  si.current_quantity,
  si.total_value,
  m.usage_unit,
  m.updated_at
FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
WHERE m.material_type IN ('finished_product', 'intermediate_product')
ORDER BY m.name;

-- 5. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_materials_material_type ON materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_is_sellable ON materials(is_sellable) WHERE is_sellable IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_recipe_id ON recipe_bom_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_material_id ON recipe_bom_items(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_date ON stock_movements(material_id, movement_date);

-- 6. TRIGGER DE VALIDAÇÃO PARA BOM (substituindo CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_recipes_bom_material_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o material é finished_product ou intermediate_product
  IF NOT EXISTS (
    SELECT 1 FROM materials 
    WHERE id = NEW.finished_material_id 
      AND material_type IN ('finished_product', 'intermediate_product')
  ) THEN
    RAISE EXCEPTION 'Material deve ser do tipo finished_product ou intermediate_product para ter receita BOM';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para recipes_bom
DROP TRIGGER IF EXISTS trigger_validate_recipes_bom_material_type ON recipes_bom;
CREATE TRIGGER trigger_validate_recipes_bom_material_type
  BEFORE INSERT OR UPDATE ON recipes_bom
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipes_bom_material_type();

-- 7. TRIGGER DE VALIDAÇÃO PARA COMPOSITE (bloquear intermediate_product)
CREATE OR REPLACE FUNCTION public.validate_composite_bom_no_intermediate()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloquear intermediate_product em composite_bom_items
  IF EXISTS (
    SELECT 1 FROM materials 
    WHERE id = NEW.component_material_id 
      AND material_type = 'intermediate_product'
  ) THEN
    RAISE EXCEPTION 'Produtos intermediários não podem ser usados diretamente em compostos. Use-os via receita do produto acabado.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para composite_bom_items
DROP TRIGGER IF EXISTS trigger_validate_composite_bom_no_intermediate ON composite_bom_items;
CREATE TRIGGER trigger_validate_composite_bom_no_intermediate
  BEFORE INSERT OR UPDATE ON composite_bom_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_composite_bom_no_intermediate();

-- 8. LOG FINAL
DO $$
BEGIN
  RAISE INFO '=== IMPLEMENTAÇÃO DE PRODUTOS INTERMEDIÁRIOS CONCLUÍDA ===';
  RAISE INFO 'Funcionalidades implementadas:';
  RAISE INFO '✓ Tipo intermediate_product adicionado aos materiais';
  RAISE INFO '✓ Coluna is_sellable para controle de vendas';
  RAISE INFO '✓ Função produce_product() genérica para finished e intermediate';
  RAISE INFO '✓ View v_product_cost incluindo intermediários';
  RAISE INFO '✓ Triggers de validação para integridade de dados';
  RAISE INFO '✓ Índices de performance criados';
  RAISE INFO 'Próximo passo: Atualizar interface do usuário';
END $$;
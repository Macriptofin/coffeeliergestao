
-- Fase 1: Hardening de Fichas Técnicas - Schema + Prevenção de Ciclos + Índices

BEGIN;

-- =========================================
-- 1. SCHEMA: Adicionar colunas faltantes
-- =========================================

-- Adicionar cost_price em materials (custo calculado via BOM)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.materials.cost_price IS 'Custo unitário calculado via BOM (para produtos intermediários/acabados)';

-- Adicionar waste_percent em recipes_bom (% de perda global da receita)
ALTER TABLE public.recipes_bom 
ADD COLUMN IF NOT EXISTS waste_percent NUMERIC DEFAULT 0 CHECK (waste_percent >= 0 AND waste_percent <= 100);

COMMENT ON COLUMN public.recipes_bom.waste_percent IS 'Percentual de perda/desperdício global da receita (0-100%)';

-- =========================================
-- 2. PREVENÇÃO DE CICLOS EM BOM
-- =========================================

CREATE OR REPLACE FUNCTION public.fn_prevent_bom_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  root_material uuid;
  cycle_detected boolean := false;
BEGIN
  -- Obter o material raiz (saída) desta BOM
  SELECT finished_material_id INTO root_material
  FROM public.recipes_bom
  WHERE id = NEW.recipe_id;

  -- Verificar se o material sendo adicionado cria um ciclo
  -- Percorre a árvore: do material inserido (NEW.material_id) descendo por suas BOMs
  WITH RECURSIVE bom_tree(material_id, depth) AS (
    -- Base: material sendo adicionado como componente
    SELECT NEW.material_id, 1
    
    UNION ALL
    
    -- Recursivo: componentes das BOMs dos materiais já visitados
    SELECT rbi.material_id, bt.depth + 1
    FROM bom_tree bt
    JOIN public.recipes_bom rb ON rb.finished_material_id = bt.material_id
    JOIN public.recipe_bom_items rbi ON rbi.recipe_id = rb.id
    WHERE bt.depth < 10  -- Limite de profundidade para evitar loops infinitos
  )
  SELECT EXISTS (
    SELECT 1 FROM bom_tree WHERE material_id = root_material
  ) INTO cycle_detected;

  IF cycle_detected THEN
    RAISE EXCEPTION 'Ciclo de BOM detectado: o material de saída (%) apareceria como seu próprio componente através da cadeia de BOMs.', root_material
      USING ERRCODE = 'P0001',
            HINT = 'Revise a estrutura de BOMs para eliminar dependências circulares.';
  END IF;

  RETURN NEW;
END$$;

-- Aplicar trigger apenas se não existir
DROP TRIGGER IF EXISTS trg_prevent_bom_cycles ON public.recipe_bom_items;
CREATE TRIGGER trg_prevent_bom_cycles
  BEFORE INSERT OR UPDATE ON public.recipe_bom_items
  FOR EACH ROW 
  EXECUTE FUNCTION public.fn_prevent_bom_cycles();

-- =========================================
-- 3. ÍNDICES DE PERFORMANCE
-- =========================================

-- Índices para consultas de BOM (se não existirem)
CREATE INDEX IF NOT EXISTS idx_recipes_bom_finished 
  ON public.recipes_bom(finished_material_id);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe 
  ON public.recipe_bom_items(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_items_material 
  ON public.recipe_bom_items(material_id);

CREATE INDEX IF NOT EXISTS idx_stock_items_material 
  ON public.stock_items(material_id);

CREATE INDEX IF NOT EXISTS idx_materials_type 
  ON public.materials(material_type) 
  WHERE material_type IN ('intermediate_product', 'finished_product');

-- Índice composto para consultas de componentes em BOM
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_material 
  ON public.recipe_bom_items(recipe_id, material_id);

-- =========================================
-- 4. VALIDAÇÃO E TESTES
-- =========================================

-- Teste básico: verificar se as colunas foram criadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'materials' 
      AND column_name = 'cost_price'
  ) THEN
    RAISE EXCEPTION 'Coluna materials.cost_price não foi criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recipes_bom' 
      AND column_name = 'waste_percent'
  ) THEN
    RAISE EXCEPTION 'Coluna recipes_bom.waste_percent não foi criada';
  END IF;

  RAISE NOTICE 'Fase 1 concluída com sucesso: Schema + Prevenção de Ciclos + Índices';
END$$;

COMMIT;

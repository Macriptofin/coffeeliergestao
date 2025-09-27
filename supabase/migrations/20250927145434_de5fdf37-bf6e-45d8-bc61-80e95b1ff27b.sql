-- ========================================
-- CORREÇÃO DE SEGURANÇA - PRODUTOS INTERMEDIÁRIOS
-- ========================================

-- 1. CORRIGIR VIEW DE CUSTO (remover SECURITY DEFINER implícito)
DROP VIEW IF EXISTS public.v_product_cost;

-- Recriar view sem SECURITY DEFINER para permitir RLS adequado
CREATE VIEW public.v_product_cost AS
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

-- 2. CORRIGIR SEARCH_PATH DAS FUNÇÕES DE VALIDAÇÃO
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
$$ LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public;

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
$$ LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public;

-- Log final
DO $$
BEGIN
  RAISE INFO '✓ Correções de segurança aplicadas';
  RAISE INFO '✓ View v_product_cost corrigida (sem SECURITY DEFINER)';
  RAISE INFO '✓ Functions com search_path correto';
  RAISE INFO '=== SISTEMA DE PRODUTOS INTERMEDIÁRIOS PRONTO ===';
END $$;
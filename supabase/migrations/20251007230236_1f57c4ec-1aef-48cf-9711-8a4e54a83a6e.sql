-- ============================================================================
-- TICKET: Correções Críticas no Módulo de Precificação e Rastreabilidade
-- Data: 07 de outubro de 2025
-- Prioridade: CRÍTICA
-- ============================================================================

-- ============================================================================
-- PARTE 1: CAMPOS ESTRUTURAIS
-- ============================================================================

-- 1.1. Adicionar idempotency_key em stock_movements
ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_stock_movements_idempotency_key 
ON stock_movements(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN stock_movements.idempotency_key IS 
'Chave de idempotência para evitar duplicação de movimentos em caso de retry.';

-- 1.2. Adicionar campos fiscais em materials
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS ncm TEXT,
ADD COLUMN IF NOT EXISTS cfop_padrao TEXT DEFAULT '5102',
ADD COLUMN IF NOT EXISTS cst_csosn TEXT DEFAULT '102',
ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;

-- Adicionar constraint de origem (0-8)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'materials_origem_check'
  ) THEN
    ALTER TABLE materials
    ADD CONSTRAINT materials_origem_check CHECK (origem BETWEEN 0 AND 8);
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN materials.ncm IS 'Nomenclatura Comum do Mercosul - obrigatório para NF-e (8 dígitos)';
COMMENT ON COLUMN materials.cfop_padrao IS 'CFOP padrão para vendas (ex: 5102 - Venda de mercadoria adquirida)';
COMMENT ON COLUMN materials.cst_csosn IS 'Código de Situação Tributária para Simples Nacional';
COMMENT ON COLUMN materials.origem IS 'Origem do produto: 0=Nacional, 1=Estrangeira-Importação direta, 2=Estrangeira-Adquirida mercado interno, etc.';

-- Índice para consultas fiscais
CREATE INDEX IF NOT EXISTS idx_materials_ncm ON materials(ncm) WHERE ncm IS NOT NULL;

-- 1.3. Documentar campos de rastreabilidade (já existem)
COMMENT ON COLUMN stock_items.average_price IS 
'Custo médio ponderado do material na unidade de uso. NUNCA deve conter preço de venda. Calculado automaticamente em compras (purchase) e produções (production).';

COMMENT ON COLUMN stock_items.cost_source IS 
'Origem do custo: purchase (compra), production (produção), manual_adjustment (ajuste manual)';

COMMENT ON COLUMN stock_items.cost_last_updated_at IS 
'Data/hora da última atualização do custo';

COMMENT ON COLUMN stock_items.cost_last_updated_by IS 
'Usuário responsável pela última atualização do custo';

COMMENT ON COLUMN stock_items.manual_price IS 
'Indica se o preço foi ajustado manualmente (TRUE) ou calculado automaticamente (FALSE)';

-- ============================================================================
-- PARTE 2: FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir flag para este ticket
INSERT INTO app_flags (flag_name, enabled, description)
VALUES (
  'use_bom_cost_persistence',
  TRUE,  -- Habilitado por padrão
  'Habilita rastreabilidade de custo (cost_source) e persistência de custos de BOM'
)
ON CONFLICT (flag_name) DO NOTHING;

-- Função para verificar flag
CREATE OR REPLACE FUNCTION is_flag_enabled(p_flag_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM app_flags WHERE flag_name = p_flag_name),
    FALSE
  );
$$;

-- ============================================================================
-- PARTE 3: FUNÇÕES SQL CORRIGIDAS
-- ============================================================================

-- 3.1. Função de Compras (process_stock_entry_with_conversion)
CREATE OR REPLACE FUNCTION process_stock_entry_with_conversion(
  p_material_id UUID,
  p_quantity_purchased NUMERIC,
  p_unit_price_purchase NUMERIC,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion_factor NUMERIC;
  v_quantity_usage_unit NUMERIC;
  v_unit_price_usage NUMERIC;
  v_current_quantity NUMERIC;
  v_current_avg_price NUMERIC;
  v_new_quantity NUMERIC;
  v_new_avg_price NUMERIC;
  v_movement_id UUID;
  v_use_cost_tracking BOOLEAN;
BEGIN
  -- Verificar feature flag
  v_use_cost_tracking := is_flag_enabled('use_bom_cost_persistence');
  
  -- Verificar idempotência
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM stock_movements 
    WHERE idempotency_key = p_idempotency_key;
    
    IF FOUND THEN
      RAISE EXCEPTION 'Movimento já processado (idempotency_key: %)', p_idempotency_key
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Garantir que existe registro de estoque
  INSERT INTO stock_items (
    material_id, 
    current_quantity, 
    average_price, 
    minimum_quantity, 
    last_movement_date
  )
  VALUES (
    p_material_id, 
    0, 
    0, 
    0, 
    NOW()
  )
  ON CONFLICT (material_id) DO NOTHING;

  -- Lock pessimista para evitar race condition
  SELECT current_quantity, average_price
  INTO v_current_quantity, v_current_avg_price
  FROM stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;

  -- Buscar fator de conversão
  SELECT conversion_factor 
  INTO v_conversion_factor
  FROM materials 
  WHERE id = p_material_id;

  IF v_conversion_factor IS NULL THEN
    RAISE EXCEPTION 'Material % não encontrado ou sem fator de conversão', p_material_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Converter para unidade de uso
  v_quantity_usage_unit := p_quantity_purchased * v_conversion_factor;
  v_unit_price_usage := p_unit_price_purchase / v_conversion_factor;

  -- Calcular novo preço médio ponderado
  v_new_quantity := COALESCE(v_current_quantity, 0) + v_quantity_usage_unit;
  
  IF v_new_quantity > 0 THEN
    v_new_avg_price := (
      (COALESCE(v_current_quantity, 0) * COALESCE(v_current_avg_price, 0)) +
      (v_quantity_usage_unit * v_unit_price_usage)
    ) / v_new_quantity;
  ELSE
    v_new_avg_price := v_unit_price_usage;
  END IF;

  -- Atualizar estoque COM ou SEM rastreabilidade (conforme flag)
  IF v_use_cost_tracking THEN
    UPDATE stock_items
    SET 
      current_quantity = v_new_quantity,
      average_price = v_new_avg_price,
      total_value = v_new_quantity * v_new_avg_price,
      last_movement_date = NOW(),
      cost_source = 'purchase',
      cost_last_updated_at = NOW(),
      cost_last_updated_by = auth.uid(),
      manual_price = FALSE,
      updated_at = NOW()
    WHERE material_id = p_material_id;
  ELSE
    UPDATE stock_items
    SET 
      current_quantity = v_new_quantity,
      average_price = v_new_avg_price,
      total_value = v_new_quantity * v_new_avg_price,
      last_movement_date = NOW(),
      updated_at = NOW()
    WHERE material_id = p_material_id;
  END IF;

  -- Registrar movimentação
  INSERT INTO stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_value,
    reference_type,
    reference_id,
    notes,
    idempotency_key
  ) VALUES (
    p_material_id,
    'PURCHASE',
    v_quantity_usage_unit,
    v_unit_price_usage,
    v_quantity_usage_unit * v_unit_price_usage,
    p_reference_type,
    p_reference_id,
    p_notes,
    p_idempotency_key
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'movement_id', v_movement_id,
    'new_quantity', v_new_quantity,
    'new_avg_price', v_new_avg_price,
    'cost_tracking_enabled', v_use_cost_tracking
  );
END;
$$;

-- 3.2. Função de Produção (process_finish_input_with_bom_cost)
CREATE OR REPLACE FUNCTION process_finish_input_with_bom_cost(
  p_material_id UUID,
  p_quantity NUMERIC,
  p_movement_type TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_id UUID;
  v_calculated_cost NUMERIC;
  v_current_quantity NUMERIC;
  v_current_avg_price NUMERIC;
  v_new_avg_price NUMERIC;
  v_total_quantity NUMERIC;
  v_use_cost_tracking BOOLEAN;
BEGIN
  -- Verificar feature flag
  v_use_cost_tracking := is_flag_enabled('use_bom_cost_persistence');
  
  -- Verificar idempotência
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM 1 FROM stock_movements 
    WHERE idempotency_key = p_idempotency_key;
    
    IF FOUND THEN
      RAISE EXCEPTION 'Movimento já processado (idempotency_key: %)', p_idempotency_key
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Verificar se existe BOM para este material
  SELECT id INTO v_bom_id
  FROM recipes_bom
  WHERE finished_material_id = p_material_id
  AND is_archived = FALSE;
  
  -- Calcular custo baseado na BOM se existir
  IF v_bom_id IS NOT NULL THEN
    SELECT cached_total_cost / NULLIF(yield_quantity, 0)
    INTO v_calculated_cost
    FROM recipes_bom
    WHERE id = v_bom_id;
    
    -- Se cached_total_cost não existe, usar preço cadastrado
    IF v_calculated_cost IS NULL THEN
      SELECT price_per_purchase_unit INTO v_calculated_cost
      FROM materials
      WHERE id = p_material_id;
    END IF;
  ELSE
    -- Usar preço cadastrado se não tiver BOM
    SELECT price_per_purchase_unit INTO v_calculated_cost
    FROM materials
    WHERE id = p_material_id;
  END IF;
  
  -- Garantir que existe registro de estoque
  INSERT INTO stock_items (
    material_id, 
    current_quantity, 
    average_price, 
    minimum_quantity, 
    last_movement_date
  )
  VALUES (
    p_material_id, 
    0, 
    COALESCE(v_calculated_cost, 0), 
    0, 
    NOW()
  )
  ON CONFLICT (material_id) DO NOTHING;
  
  -- Lock pessimista
  SELECT current_quantity, average_price 
  INTO v_current_quantity, v_current_avg_price
  FROM stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;
  
  -- Calcular nova quantidade e preço médio móvel
  v_total_quantity := COALESCE(v_current_quantity, 0) + p_quantity;
  
  IF v_total_quantity > 0 THEN
    v_new_avg_price := (
      (COALESCE(v_current_quantity, 0) * COALESCE(v_current_avg_price, 0)) + 
      (p_quantity * COALESCE(v_calculated_cost, 0))
    ) / v_total_quantity;
  ELSE
    v_new_avg_price := COALESCE(v_calculated_cost, 0);
  END IF;
  
  -- Atualizar estoque COM ou SEM rastreabilidade (conforme flag)
  IF v_use_cost_tracking THEN
    UPDATE stock_items
    SET 
      current_quantity = v_total_quantity,
      average_price = v_new_avg_price,
      total_value = v_total_quantity * v_new_avg_price,
      last_movement_date = NOW(),
      cost_source = 'production',
      cost_last_updated_at = NOW(),
      cost_last_updated_by = auth.uid(),
      manual_price = FALSE,
      updated_at = NOW()
    WHERE material_id = p_material_id;
  ELSE
    UPDATE stock_items
    SET 
      current_quantity = v_total_quantity,
      average_price = v_new_avg_price,
      total_value = v_total_quantity * v_new_avg_price,
      last_movement_date = NOW(),
      updated_at = NOW()
    WHERE material_id = p_material_id;
  END IF;
  
  -- Registrar movimentação
  INSERT INTO stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_value,
    notes,
    idempotency_key
  ) VALUES (
    p_material_id,
    p_movement_type,
    p_quantity,
    v_calculated_cost,
    p_quantity * COALESCE(v_calculated_cost, 0),
    'Produção com custo calculado pela BOM',
    p_idempotency_key
  );
END;
$$;

-- 3.3. Função de Ajustes Manuais (process_cost_adjustment) - JÁ EXISTE, MODIFICAR
CREATE OR REPLACE FUNCTION process_cost_adjustment(
  p_material_id UUID,
  p_new_unit_cost NUMERIC,
  p_adjustment_reason TEXT,
  p_reference_document TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_cost NUMERIC;
  v_current_quantity NUMERIC;
  v_adjustment_id UUID;
  v_use_cost_tracking BOOLEAN;
  v_old_total_value NUMERIC;
  v_new_total_value NUMERIC;
  v_cost_difference NUMERIC;
BEGIN
  -- Verificar feature flag
  v_use_cost_tracking := is_flag_enabled('use_bom_cost_persistence');
  
  -- Garantir que existe registro de estoque
  INSERT INTO stock_items (
    material_id, 
    current_quantity, 
    average_price, 
    minimum_quantity, 
    last_movement_date
  )
  VALUES (
    p_material_id, 
    0, 
    0, 
    0, 
    NOW()
  )
  ON CONFLICT (material_id) DO NOTHING;
  
  -- Lock pessimista
  SELECT average_price, current_quantity, total_value
  INTO v_old_cost, v_current_quantity, v_old_total_value
  FROM stock_items
  WHERE material_id = p_material_id
  FOR UPDATE;
  
  -- Calcular novos valores
  v_new_total_value := v_current_quantity * p_new_unit_cost;
  v_cost_difference := v_new_total_value - COALESCE(v_old_total_value, 0);
  
  -- Registrar ajuste na tabela de auditoria
  INSERT INTO cost_adjustments (
    material_id,
    adjustment_date,
    adjustment_time,
    old_unit_cost,
    new_unit_cost,
    current_quantity,
    old_total_value,
    new_total_value,
    cost_difference,
    adjustment_reason,
    reference_document,
    notes,
    responsible_user_id
  ) VALUES (
    p_material_id,
    CURRENT_DATE,
    CURRENT_TIME,
    v_old_cost,
    p_new_unit_cost,
    v_current_quantity,
    v_old_total_value,
    v_new_total_value,
    v_cost_difference,
    p_adjustment_reason,
    p_reference_document,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_adjustment_id;
  
  -- Atualizar estoque COM ou SEM rastreabilidade (conforme flag)
  IF v_use_cost_tracking THEN
    UPDATE stock_items
    SET 
      average_price = p_new_unit_cost,
      total_value = v_new_total_value,
      last_movement_date = NOW(),
      cost_source = 'manual_adjustment',
      cost_last_updated_at = NOW(),
      cost_last_updated_by = auth.uid(),
      manual_price = TRUE,
      updated_at = NOW()
    WHERE material_id = p_material_id;
  ELSE
    UPDATE stock_items
    SET 
      average_price = p_new_unit_cost,
      total_value = v_new_total_value,
      last_movement_date = NOW(),
      updated_at = NOW()
    WHERE material_id = p_material_id;
  END IF;
  
  RETURN v_adjustment_id;
END;
$$;

-- ============================================================================
-- PARTE 4: VIEW DE AUDITORIA
-- ============================================================================

CREATE OR REPLACE VIEW vw_cost_audit AS
SELECT 
  m.id AS material_id,
  m.code AS material_code,
  m.name AS material_name,
  m.material_type,
  m.usage_unit,
  
  -- Custo atual
  si.average_price AS current_unit_cost,
  si.current_quantity,
  si.total_value,
  
  -- Rastreabilidade
  si.cost_source,
  si.manual_price,
  si.cost_last_updated_at,
  u.email AS cost_last_updated_by_email,
  
  -- Último movimento
  (
    SELECT sm.movement_type 
    FROM stock_movements sm 
    WHERE sm.material_id = m.id 
    ORDER BY sm.movement_date DESC 
    LIMIT 1
  ) AS last_movement_type,
  (
    SELECT sm.quantity 
    FROM stock_movements sm 
    WHERE sm.material_id = m.id 
    ORDER BY sm.movement_date DESC 
    LIMIT 1
  ) AS last_movement_quantity,
  (
    SELECT sm.unit_price 
    FROM stock_movements sm 
    WHERE sm.material_id = m.id 
    ORDER BY sm.movement_date DESC 
    LIMIT 1
  ) AS last_movement_unit_price,
  si.last_movement_date,
  
  -- Flags de qualidade
  CASE 
    WHEN m.density_g_per_ml IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END AS has_density,
  
  CASE 
    WHEN si.cost_source IS NULL THEN 'SEM_RASTREABILIDADE'
    WHEN si.manual_price = TRUE THEN 'CUSTO_MANUAL'
    WHEN si.cost_source = 'purchase' THEN 'CUSTO_COMPRA'
    WHEN si.cost_source = 'production' THEN 'CUSTO_PRODUCAO'
    ELSE 'OUTRO'
  END AS cost_status,
  
  -- BOM (se houver)
  rb.id AS bom_id,
  rb.cached_total_cost AS bom_total_cost,
  rb.cached_unit_cost AS bom_unit_cost,
  rb.cost_last_calculated_at AS bom_cost_calculated_at,
  
  -- Campos fiscais
  m.ncm,
  m.cfop_padrao,
  m.cst_csosn,
  m.origem

FROM materials m
LEFT JOIN stock_items si ON si.material_id = m.id
LEFT JOIN auth.users u ON u.id = si.cost_last_updated_by
LEFT JOIN recipes_bom rb ON rb.finished_material_id = m.id AND rb.is_archived = FALSE
WHERE m.is_archived = FALSE
ORDER BY m.name;

COMMENT ON VIEW vw_cost_audit IS 
'VIEW de auditoria de custos. Exibe todos os materiais com informações de custo, rastreabilidade, fiscal e último movimento. Útil para auditorias fiscais, contábeis e relatórios gerenciais.';

-- ============================================================================
-- PARTE 5: RLS POLICY PARA APP_FLAGS
-- ============================================================================

ALTER TABLE app_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view app_flags" ON app_flags
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage app_flags" ON app_flags
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- 1. Criar tabela para histórico de custos de BOM
CREATE TABLE IF NOT EXISTS bom_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_type TEXT NOT NULL CHECK (bom_type IN ('recipe', 'composite')),
  bom_id UUID NOT NULL,
  old_total_cost NUMERIC(14, 4),
  new_total_cost NUMERIC(14, 4),
  cost_change_percent NUMERIC(8, 2),
  cost_change_absolute NUMERIC(14, 4),
  triggered_by_material_id UUID,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_bom_cost_history_bom_type_id 
  ON bom_cost_history(bom_type, bom_id);
  
CREATE INDEX IF NOT EXISTS idx_bom_cost_history_created_at 
  ON bom_cost_history(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_bom_cost_history_material_id 
  ON bom_cost_history(triggered_by_material_id);

-- 3. Criar tabela para alertas de variação de custo
CREATE TABLE IF NOT EXISTS bom_cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_type TEXT NOT NULL CHECK (bom_type IN ('recipe', 'composite')),
  bom_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('significant_increase', 'significant_decrease', 'threshold_exceeded')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  old_cost NUMERIC(14, 4),
  new_cost NUMERIC(14, 4),
  change_percent NUMERIC(8, 2),
  threshold_percent NUMERIC(8, 2),
  message TEXT NOT NULL,
  triggered_by_material_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Criar índices para alertas
CREATE INDEX IF NOT EXISTS idx_bom_cost_alerts_bom_type_id 
  ON bom_cost_alerts(bom_type, bom_id);
  
CREATE INDEX IF NOT EXISTS idx_bom_cost_alerts_is_read 
  ON bom_cost_alerts(is_read) WHERE is_read = FALSE;
  
CREATE INDEX IF NOT EXISTS idx_bom_cost_alerts_created_at 
  ON bom_cost_alerts(created_at DESC);

-- 5. Atualizar função refresh_bom_costs_for_material para registrar histórico
CREATE OR REPLACE FUNCTION refresh_bom_costs_for_material(p_material_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_recipe_boms INTEGER := 0;
  v_affected_composite_boms INTEGER := 0;
  v_alerts_created INTEGER := 0;
  v_threshold_percent NUMERIC := 10.0; -- Threshold padrão de 10%
  v_result jsonb;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_change_percent NUMERIC;
BEGIN
  -- Atualizar custos de recipes_bom que usam este material
  WITH cost_changes AS (
    SELECT 
      rb.id as bom_id,
      rb.cached_total_cost as old_cost,
      (
        SELECT SUM(
          rbi.quantity * 
          COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
        )
        FROM recipe_bom_items rbi
        JOIN materials m ON m.id = rbi.material_id
        LEFT JOIN stock_items si ON si.material_id = rbi.material_id
        WHERE rbi.recipe_id = rb.id
      ) as new_cost,
      rb.yield_quantity
    FROM recipes_bom rb
    WHERE rb.id IN (
      SELECT DISTINCT rbi.recipe_id
      FROM recipe_bom_items rbi
      WHERE rbi.material_id = p_material_id
    )
  ),
  updated_recipes AS (
    UPDATE recipes_bom rb
    SET 
      cached_total_cost = cc.new_cost,
      cached_unit_cost = cc.new_cost / NULLIF(cc.yield_quantity, 0),
      cost_last_calculated_at = NOW()
    FROM cost_changes cc
    WHERE rb.id = cc.bom_id
    RETURNING rb.id, cc.old_cost, cc.new_cost
  )
  INSERT INTO bom_cost_history (bom_type, bom_id, old_total_cost, new_total_cost, cost_change_absolute, cost_change_percent, triggered_by_material_id, change_reason)
  SELECT 
    'recipe',
    ur.id,
    ur.old_cost,
    ur.new_cost,
    ur.new_cost - COALESCE(ur.old_cost, 0),
    CASE 
      WHEN ur.old_cost IS NULL OR ur.old_cost = 0 THEN NULL
      ELSE ((ur.new_cost - ur.old_cost) / ur.old_cost * 100)
    END,
    p_material_id,
    'Material price change'
  FROM updated_recipes ur
  WHERE ur.old_cost IS DISTINCT FROM ur.new_cost;

  GET DIAGNOSTICS v_affected_recipe_boms = ROW_COUNT;

  -- Criar alertas para variações significativas em recipes
  INSERT INTO bom_cost_alerts (bom_type, bom_id, alert_type, severity, old_cost, new_cost, change_percent, threshold_percent, message, triggered_by_material_id)
  SELECT 
    'recipe',
    bch.bom_id,
    CASE 
      WHEN bch.cost_change_percent > 0 THEN 'significant_increase'
      ELSE 'significant_decrease'
    END,
    CASE 
      WHEN ABS(bch.cost_change_percent) >= 30 THEN 'critical'
      WHEN ABS(bch.cost_change_percent) >= 20 THEN 'high'
      WHEN ABS(bch.cost_change_percent) >= 10 THEN 'medium'
      ELSE 'low'
    END,
    bch.old_total_cost,
    bch.new_total_cost,
    bch.cost_change_percent,
    v_threshold_percent,
    format('Custo da receita variou %s%%: de R$ %s para R$ %s', 
      ROUND(bch.cost_change_percent, 2),
      ROUND(bch.old_total_cost, 2),
      ROUND(bch.new_total_cost, 2)
    ),
    p_material_id
  FROM bom_cost_history bch
  WHERE bch.bom_type = 'recipe'
    AND bch.triggered_by_material_id = p_material_id
    AND ABS(bch.cost_change_percent) >= v_threshold_percent
    AND bch.created_at > NOW() - INTERVAL '1 minute';

  GET DIAGNOSTICS v_alerts_created = ROW_COUNT;

  -- Atualizar custos de composites_bom que usam este material
  WITH cost_changes AS (
    SELECT 
      cb.id as bom_id,
      cb.cached_total_cost as old_cost,
      (
        SELECT SUM(
          cbi.quantity * 
          COALESCE(si.average_price, m.price_per_purchase_unit / m.conversion_factor, 0)
        )
        FROM composite_bom_items cbi
        JOIN materials m ON m.id = cbi.component_material_id
        LEFT JOIN stock_items si ON si.material_id = cbi.component_material_id
        WHERE cbi.composite_id = cb.id
      ) as new_cost
    FROM composites_bom cb
    WHERE cb.id IN (
      SELECT DISTINCT cbi.composite_id
      FROM composite_bom_items cbi
      WHERE cbi.component_material_id = p_material_id
    )
  ),
  updated_composites AS (
    UPDATE composites_bom cb
    SET 
      cached_total_cost = cc.new_cost,
      cost_last_calculated_at = NOW()
    FROM cost_changes cc
    WHERE cb.id = cc.bom_id
    RETURNING cb.id, cc.old_cost, cc.new_cost
  )
  INSERT INTO bom_cost_history (bom_type, bom_id, old_total_cost, new_total_cost, cost_change_absolute, cost_change_percent, triggered_by_material_id, change_reason)
  SELECT 
    'composite',
    uc.id,
    uc.old_cost,
    uc.new_cost,
    uc.new_cost - COALESCE(uc.old_cost, 0),
    CASE 
      WHEN uc.old_cost IS NULL OR uc.old_cost = 0 THEN NULL
      ELSE ((uc.new_cost - uc.old_cost) / uc.old_cost * 100)
    END,
    p_material_id,
    'Material price change'
  FROM updated_composites uc
  WHERE uc.old_cost IS DISTINCT FROM uc.new_cost;

  GET DIAGNOSTICS v_affected_composite_boms = ROW_COUNT;

  -- Criar alertas para variações significativas em composites
  INSERT INTO bom_cost_alerts (bom_type, bom_id, alert_type, severity, old_cost, new_cost, change_percent, threshold_percent, message, triggered_by_material_id)
  SELECT 
    'composite',
    bch.bom_id,
    CASE 
      WHEN bch.cost_change_percent > 0 THEN 'significant_increase'
      ELSE 'significant_decrease'
    END,
    CASE 
      WHEN ABS(bch.cost_change_percent) >= 30 THEN 'critical'
      WHEN ABS(bch.cost_change_percent) >= 20 THEN 'high'
      WHEN ABS(bch.cost_change_percent) >= 10 THEN 'medium'
      ELSE 'low'
    END,
    bch.old_total_cost,
    bch.new_total_cost,
    bch.cost_change_percent,
    v_threshold_percent,
    format('Custo do composto variou %s%%: de R$ %s para R$ %s', 
      ROUND(bch.cost_change_percent, 2),
      ROUND(bch.old_total_cost, 2),
      ROUND(bch.new_total_cost, 2)
    ),
    p_material_id
  FROM bom_cost_history bch
  WHERE bch.bom_type = 'composite'
    AND bch.triggered_by_material_id = p_material_id
    AND ABS(bch.cost_change_percent) >= v_threshold_percent
    AND bch.created_at > NOW() - INTERVAL '1 minute';

  v_result := jsonb_build_object(
    'material_id', p_material_id,
    'affected_recipe_boms', v_affected_recipe_boms,
    'affected_composite_boms', v_affected_composite_boms,
    'alerts_created', v_alerts_created,
    'updated_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- 6. Criar função para marcar alertas como lidos
CREATE OR REPLACE FUNCTION mark_bom_cost_alert_as_read(p_alert_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE bom_cost_alerts
  SET 
    is_read = TRUE,
    read_at = NOW(),
    read_by = auth.uid()
  WHERE id = p_alert_id;
END;
$$;

-- 7. Criar view para facilitar consultas de histórico com nomes de materiais
CREATE OR REPLACE VIEW vw_bom_cost_history_detailed AS
SELECT 
  bch.id,
  bch.bom_type,
  bch.bom_id,
  CASE 
    WHEN bch.bom_type = 'recipe' THEN (
      SELECT m.name 
      FROM recipes_bom rb 
      JOIN materials m ON m.id = rb.finished_material_id 
      WHERE rb.id = bch.bom_id
    )
    WHEN bch.bom_type = 'composite' THEN (
      SELECT m.name 
      FROM composites_bom cb 
      JOIN materials m ON m.id = cb.composite_material_id 
      WHERE cb.id = bch.bom_id
    )
  END as bom_name,
  bch.old_total_cost,
  bch.new_total_cost,
  bch.cost_change_percent,
  bch.cost_change_absolute,
  bch.triggered_by_material_id,
  (SELECT name FROM materials WHERE id = bch.triggered_by_material_id) as triggered_by_material_name,
  bch.change_reason,
  bch.created_at,
  bch.created_by
FROM bom_cost_history bch
ORDER BY bch.created_at DESC;

-- 8. RLS policies para bom_cost_history
ALTER TABLE bom_cost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view bom_cost_history"
  ON bom_cost_history FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "System can insert bom_cost_history"
  ON bom_cost_history FOR INSERT
  WITH CHECK (true);

-- 9. RLS policies para bom_cost_alerts
ALTER TABLE bom_cost_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view bom_cost_alerts"
  ON bom_cost_alerts FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update bom_cost_alerts"
  ON bom_cost_alerts FOR UPDATE
  USING (is_admin_or_manager(auth.uid()));

-- 10. Comentários
COMMENT ON TABLE bom_cost_history IS 'Histórico de mudanças de custos de BOMs ao longo do tempo';
COMMENT ON TABLE bom_cost_alerts IS 'Alertas gerados quando custos de BOMs variam significativamente';
COMMENT ON FUNCTION mark_bom_cost_alert_as_read IS 'Marca um alerta de variação de custo como lido';
COMMENT ON VIEW vw_bom_cost_history_detailed IS 'View com histórico de custos incluindo nomes de materiais e BOMs';
-- =====================================================
-- FASE 8: Sistema de Alertas Operacionais
-- Data: 2026-05-30
-- =====================================================

CREATE TABLE IF NOT EXISTS operational_alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type     text NOT NULL,
  severity       text NOT NULL CHECK (severity IN ('info','warning','critical')),
  module         text NOT NULL,
  reference_type text,
  reference_id   uuid,
  title          text NOT NULL,
  message        text,
  is_read        boolean DEFAULT false,
  read_by        uuid,
  read_at        timestamptz,
  auto_resolved  boolean DEFAULT false,
  resolved_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_view"   ON operational_alerts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_manage" ON operational_alerts FOR ALL    USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_op_alerts_unread ON operational_alerts(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_alerts_module ON operational_alerts(module, severity);

CREATE OR REPLACE FUNCTION fn_check_stock_alert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE mat_name text;
BEGIN
  SELECT name INTO mat_name FROM materials WHERE id = NEW.material_id;
  IF NEW.current_quantity <= 0 AND (OLD.current_quantity IS NULL OR OLD.current_quantity > 0) THEN
    INSERT INTO operational_alerts (alert_type,severity,module,reference_type,reference_id,title,message)
    VALUES ('estoque_zerado','critical','materiais','stock_items',NEW.id,
      'Estoque zerado: '||COALESCE(mat_name,'Material'),
      'O material "'||COALESCE(mat_name,'Material')||'" atingiu estoque zero.');
  ELSIF NEW.current_quantity > 0 AND NEW.minimum_quantity > 0
    AND NEW.current_quantity < NEW.minimum_quantity
    AND (OLD.current_quantity IS NULL OR OLD.current_quantity >= OLD.minimum_quantity) THEN
    INSERT INTO operational_alerts (alert_type,severity,module,reference_type,reference_id,title,message)
    VALUES ('estoque_minimo','warning','materiais','stock_items',NEW.id,
      'Estoque abaixo do mínimo: '||COALESCE(mat_name,'Material'),
      'Atual: '||NEW.current_quantity||' (mínimo: '||NEW.minimum_quantity||')');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stock_alert ON stock_items;
CREATE TRIGGER trg_stock_alert AFTER INSERT OR UPDATE OF current_quantity ON stock_items
  FOR EACH ROW EXECUTE FUNCTION fn_check_stock_alert();

CREATE OR REPLACE FUNCTION fn_check_proposal_alert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'aprovada' AND OLD.status != 'aprovada' AND NEW.auto_generated_bom_order_id IS NULL THEN
    INSERT INTO operational_alerts (alert_type,severity,module,reference_type,reference_id,title,message)
    VALUES ('evento_sem_producao','warning','vendas','proposals',NEW.id,
      'Proposta aprovada sem OP: '||COALESCE(NEW.proposal_number,NEW.id::text),
      'A proposta foi aprovada mas não gerou ordem de produção automaticamente.');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_proposal_alert ON proposals;
CREATE TRIGGER trg_proposal_alert AFTER UPDATE OF status ON proposals
  FOR EACH ROW EXECUTE FUNCTION fn_check_proposal_alert();

CREATE OR REPLACE FUNCTION mark_alert_read(p_alert_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE operational_alerts SET is_read=true, read_by=p_user_id, read_at=now() WHERE id=p_alert_id;
$$;

CREATE OR REPLACE FUNCTION count_unread_alerts()
RETURNS TABLE(total bigint, critical bigint, warning bigint) LANGUAGE sql STABLE AS $$
  SELECT COUNT(*), COUNT(*) FILTER (WHERE severity='critical'), COUNT(*) FILTER (WHERE severity='warning')
  FROM operational_alerts WHERE is_read=false AND auto_resolved=false;
$$;

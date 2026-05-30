-- =====================================================
-- FASE 2: Estoque Inteligente — 6 estados
-- Data: 2026-05-30
-- =====================================================

ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS reserved_qty  numeric DEFAULT 0 CHECK (reserved_qty >= 0),
  ADD COLUMN IF NOT EXISTS committed_qty numeric DEFAULT 0 CHECK (committed_qty >= 0),
  ADD COLUMN IF NOT EXISTS ideal_qty     numeric;

CREATE OR REPLACE VIEW vw_stock_available AS
SELECT
  si.id, si.material_id,
  m.name AS material_name, m.usage_unit,
  si.current_quantity                                                            AS saldo_fisico,
  si.reserved_qty                                                               AS reservado,
  si.committed_qty                                                              AS comprometido,
  GREATEST(0, si.current_quantity - si.reserved_qty - si.committed_qty)        AS disponivel,
  si.minimum_quantity AS minimo, si.ideal_qty AS ideal,
  si.average_price AS custo_medio, si.total_value AS valor_total,
  CASE
    WHEN si.current_quantity <= 0                       THEN 'zerado'
    WHEN si.current_quantity <= si.minimum_quantity     THEN 'critico'
    WHEN si.current_quantity < (si.minimum_quantity * 1.5) THEN 'baixo'
    ELSE 'normal'
  END AS status_estoque
FROM stock_items si
JOIN materials m ON m.id = si.material_id
WHERE m.is_archived = false;

CREATE OR REPLACE FUNCTION reserve_stock_for_production_order()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    UPDATE stock_items si
    SET reserved_qty = COALESCE(reserved_qty, 0) + cm.total_quantity
    FROM bom_production_consolidated_materials cm
    WHERE cm.production_order_id = NEW.id AND cm.material_id = si.material_id AND NOT cm.is_reserved;
    UPDATE bom_production_consolidated_materials SET is_reserved = true
    WHERE production_order_id = NEW.id AND NOT is_reserved;
  END IF;
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status = 'in_progress' THEN
    UPDATE stock_items si
    SET reserved_qty = GREATEST(0, COALESCE(reserved_qty, 0) - cm.total_quantity)
    FROM bom_production_consolidated_materials cm
    WHERE cm.production_order_id = NEW.id AND cm.material_id = si.material_id
      AND cm.is_reserved AND NOT cm.is_consumed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserve_stock_on_production ON bom_production_orders;
CREATE TRIGGER trg_reserve_stock_on_production
  AFTER UPDATE OF status ON bom_production_orders
  FOR EACH ROW EXECUTE FUNCTION reserve_stock_for_production_order();

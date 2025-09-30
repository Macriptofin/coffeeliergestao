
-- Refinalizar os ciclos anteriores para atualizar stock_items
DO $$
DECLARE
  v_cycle_id UUID;
BEGIN
  -- Processar cada ciclo fechado que ainda tem ajustes em draft
  FOR v_cycle_id IN
    SELECT DISTINCT ic.id
    FROM inventory_cycles ic
    JOIN inventory_adjustments ia ON ia.cycle_id = ic.id
    WHERE ic.status = 'closed'
      AND ia.is_draft = TRUE
  LOOP
    -- Chamar a função de finalização para cada ciclo
    PERFORM rpc_inventory_finalize(v_cycle_id);
  END LOOP;
END $$;

-- Arquivar o Glacê Real (marcar como arquivado em vez de deletar)
UPDATE materials
SET is_archived = TRUE,
    updated_at = NOW()
WHERE code = 'INS0122' AND name LIKE '%Glacê%';

-- Log da correção
INSERT INTO ops_bom_audit_log (action, detail, user_id)
VALUES (
  'FIX_INVENTORY_CYCLES',
  jsonb_build_object(
    'description', 'Refinalização de ciclos fechados com stock_items não atualizados',
    'glace_archived', true,
    'timestamp', NOW()
  ),
  auth.uid()
);

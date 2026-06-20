-- A) Saneamento de saldo dos materiais arquivados/descontinuados (idempotente).
--    Zera quantidade e valor, registrando auditoria em inventory_adjustments.
--    Correção de dado legado (saldos negativos impossíveis, custos espúrios) — sem DRE.
INSERT INTO public.inventory_adjustments (
  material_id, adjustment_date, adjustment_time,
  system_quantity, physical_quantity,
  adjustment_reason, reference_document, responsible_user_id,
  notes, is_draft, reason_code, responsible_person
)
SELECT m.id, current_date, current_time,
  si.current_quantity, 0,
  'Saneamento de catálogo — material descontinuado/arquivado',
  'DEPURACAO-CATALOGO-2026-06', NULL,
  'Zeragem de saldo residual (correção de dado legado, sem impacto em DRE)',
  false, NULL, 'Depuração de catálogo'
FROM public.materials m
JOIN public.stock_items si ON si.material_id = m.id
WHERE m.is_archived = true AND COALESCE(si.current_quantity,0) <> 0;

UPDATE public.stock_items si
SET current_quantity = 0, total_value = 0, last_movement_date = now(), updated_at = now()
FROM public.materials m
WHERE m.id = si.material_id AND m.is_archived = true AND COALESCE(si.current_quantity,0) <> 0;

-- B) Remove a sobrecarga QUEBRADA de process_inventory_adjustment (9 params, com p_cycle_id):
--    referenciava colunas inexistentes (occurred_at/adjustment_type), nunca era chamada
--    pelo app (ambos os callers usam a de 8 params) nem por outras funções. Código morto.
--    Removê-la também elimina ambiguidade de resolução de sobrecarga.
DROP FUNCTION IF EXISTS public.process_inventory_adjustment(uuid, numeric, text, text, text, text, text, date, uuid);

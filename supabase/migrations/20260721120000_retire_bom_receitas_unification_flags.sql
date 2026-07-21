-- Unificação BOM/Receitas (jun/2026) virou permanente no código; remove as flags
-- de transição que só existiam para alternar entre o modelo legado e o unificado.
-- FF_EVENT_TABLES_ENABLED é preservada (ainda gate real de uma feature ativa).
DELETE FROM public.app_settings
WHERE key IN ('FF_UNIFY_BOM_RECEITAS', 'FF_MOVE_COSTS_TO_REPORTS', 'FF_ORDERS_AS_CENTRAL', 'FF_HIDE_LEGACY_RECIPES');

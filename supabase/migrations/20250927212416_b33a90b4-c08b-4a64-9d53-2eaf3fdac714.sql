-- Limpeza completa do módulo de produção
-- Manter apenas materiais, estoque e movimentações

-- 1. Fazer backup das tabelas que vamos limpar
CREATE SCHEMA IF NOT EXISTS backup;

-- Backup dos produtos (se não existir ainda)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'backup' 
                   AND table_name = 'products_backup_' || to_char(now(), 'YYYYMMDD')) THEN
        EXECUTE format('CREATE TABLE backup.products_backup_%s AS SELECT * FROM public.products', 
                      to_char(now(), 'YYYYMMDD'));
    END IF;
END $$;

-- 2. Limpar produtos legados (referenciam recipe_id do sistema antigo)
DELETE FROM public.products WHERE recipe_id IS NOT NULL;

-- 3. Garantir que todas as tabelas de produção estão limpas
-- (já devem estar vazias, mas vamos confirmar)

DELETE FROM public.recipe_bom_items;
DELETE FROM public.recipes_bom; 
DELETE FROM public.composite_bom_items;
DELETE FROM public.composites_bom;

-- 4. Limpar ordens de produção e eventos relacionados
DELETE FROM public.event_production_order_items;
DELETE FROM public.event_production_orders;
DELETE FROM public.event_table_items;
DELETE FROM public.event_tables;

-- 5. Limpar checklist e notificações de eventos
DELETE FROM public.event_checklist;
DELETE FROM public.event_notifications;

-- 6. Garantir que a flag de ocultar legado está ativa
INSERT INTO public.app_settings (key, value) 
VALUES ('FF_HIDE_LEGACY_RECIPES', 'true')
ON CONFLICT (key) 
DO UPDATE SET value = 'true', updated_at = now();

-- 7. Log da operação
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
    'FULL_PRODUCTION_CLEANUP',
    jsonb_build_object(
        'timestamp', now(),
        'description', 'Limpeza completa do módulo de produção',
        'tables_cleaned', ARRAY[
            'products', 'recipes_bom', 'recipe_bom_items', 
            'composites_bom', 'composite_bom_items',
            'event_production_orders', 'event_production_order_items',
            'event_tables', 'event_table_items',
            'event_checklist', 'event_notifications'
        ]
    ),
    auth.uid()
);
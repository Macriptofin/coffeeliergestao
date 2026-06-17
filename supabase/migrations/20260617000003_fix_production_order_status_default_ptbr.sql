-- Correção de raiz: o DEFAULT de status estava em inglês ('planned'), violando o
-- CHECK que exige PT ('Planejado','Em Produção','Concluído','Cancelado').
-- Qualquer insert que omitisse status (ex.: criação manual de OP via
-- ProductionOrderBOM) falhava com erro de constraint.
ALTER TABLE public.bom_production_orders   ALTER COLUMN status SET DEFAULT 'Planejado';
ALTER TABLE public.event_production_orders ALTER COLUMN status SET DEFAULT 'Planejado';

-- Normaliza eventuais registros antigos em inglês (defensivo)
UPDATE public.bom_production_orders   SET status = 'Planejado'    WHERE status = 'planned';
UPDATE public.bom_production_orders   SET status = 'Em Produção'  WHERE status = 'in_progress';
UPDATE public.bom_production_orders   SET status = 'Concluído'    WHERE status = 'completed';
UPDATE public.bom_production_orders   SET status = 'Cancelado'    WHERE status = 'cancelled';
UPDATE public.event_production_orders SET status = 'Planejado'    WHERE status = 'planned';

-- Solicitação de alteração do portal: sininho automático + e-mail interno
-- configurável (20/ago/2026). Problema real do teste CMPC: a solicitação caía
-- só na aba Vendas → Portal, sem sino e sem e-mail — fácil de ficar perdida.
--
-- 1) app_settings 'portal.internal_notify_email': destinatário do aviso
--    interno de nova solicitação (editável em Vendas → Portal → Configurações;
--    consumido pela edge function notify-internal-change-request).
-- 2) Trigger em proposal_change_requests: INSERT gera operational_alerts
--    (module 'vendas') — o NotificationBell já escuta INSERTs dessa tabela em
--    tempo real, então o sino acende na hora, sem depender do front do portal.
-- 3) Alerta retroativo pra solicitação aberta que já existia antes do trigger.

INSERT INTO public.app_settings (key, value)
VALUES ('portal.internal_notify_email', 'coffeelier.co@gmail.com')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_change_request_operational_alert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
declare
  v_number text;
  v_client text;
begin
  select p.proposal_number, c.name into v_number, v_client
  from public.proposals p
  left join public.clients c on c.id = p.client_id
  where p.id = NEW.proposal_id;

  insert into public.operational_alerts
    (alert_type, severity, module, reference_type, reference_id, title, message)
  values (
    'portal_change_request', 'warning', 'vendas',
    'proposal_change_request', NEW.id,
    'Solicitação de alteração — Prop. ' || coalesce(v_number, '?')
      || coalesce(' (' || v_client || ')', ''),
    left(NEW.message, 500)
  );
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_change_request_alert ON public.proposal_change_requests;
CREATE TRIGGER trg_change_request_alert
AFTER INSERT ON public.proposal_change_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_change_request_operational_alert();

-- Retroativo: solicitações abertas criadas antes do trigger ganham o alerta
-- (idempotente — só cria se ainda não existe alerta referenciando a solicitação).
INSERT INTO public.operational_alerts
  (alert_type, severity, module, reference_type, reference_id, title, message)
SELECT
  'portal_change_request', 'warning', 'vendas',
  'proposal_change_request', pcr.id,
  'Solicitação de alteração — Prop. ' || coalesce(p.proposal_number, '?')
    || coalesce(' (' || c.name || ')', ''),
  left(pcr.message, 500)
FROM public.proposal_change_requests pcr
JOIN public.proposals p ON p.id = pcr.proposal_id
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE pcr.status = 'aberta'
  AND NOT EXISTS (
    SELECT 1 FROM public.operational_alerts oa
    WHERE oa.reference_type = 'proposal_change_request'
      AND oa.reference_id = pcr.id
  );

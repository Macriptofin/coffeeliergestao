-- Nenhum mecanismo avisava a equipe quando um cliente monta e envia um pedido
-- pelo Portal (status vira 'Enviada' com created_by_client=true) — reaproveita
-- o barramento de alertas já existente (operational_alerts / NotificationBell,
-- mesmo padrão de fn_check_proposal_alert em 20260530000004_fase8_operational_alerts.sql).
-- Dispara em INSERT (pedido novo já nasce 'Enviada') e em transição de status
-- pra 'Enviada' (rascunho enviado depois); guarda contra re-disparo quando um
-- pedido já 'Enviada' é apenas re-salvo (create_portal_order permite reeditar
-- enquanto não aprovado).
CREATE OR REPLACE FUNCTION public.fn_check_client_proposal_submitted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by_client = true AND NEW.status = 'Enviada'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Enviada') THEN
    INSERT INTO public.operational_alerts (alert_type, severity, module, reference_type, reference_id, title, message)
    VALUES ('pedido_cliente_recebido', 'warning', 'vendas', 'proposals', NEW.id,
      'Novo pedido do cliente: ' || COALESCE(NEW.event_name, NEW.proposal_number, NEW.id::text),
      'O cliente enviou um pedido pelo Portal (' || COALESCE(NEW.proposal_number, '') || ') e aguarda análise da equipe.');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_proposal_submitted ON public.proposals;
CREATE TRIGGER trg_client_proposal_submitted
  AFTER INSERT OR UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_client_proposal_submitted();

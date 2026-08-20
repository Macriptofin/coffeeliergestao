-- Cliente solicita fornecimento (execução de guarda-chuva) pelo Portal
-- (20/ago/2026, requisito confirmado no teste real com a CMPC).
--
-- Fluxo: cliente monta o pedido (nome do evento, data, hora, pessoas, sala) no
-- portal → cai pra equipe (sininho por trigger + e-mail via edge) → a equipe
-- APROVA e só então dispara a cadeia real: a aprovação chama
-- add_umbrella_execution (composição + evento + ordens + abate de saldo) e
-- vincula a solicitação à execução criada. O gate interno é preservado: o
-- cliente nunca gera evento/ordem direto.
--
-- RLS espelha proposal_change_requests: interno ALL; portal INSERT/SELECT
-- escopado ao próprio cliente.

CREATE TABLE public.umbrella_execution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  requested_by uuid NOT NULL,
  name text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NULL,
  number_of_people int NOT NULL CHECK (number_of_people > 0),
  room_id uuid NULL REFERENCES public.client_rooms(id),
  location text NULL,
  notes text NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'aprovada', 'recusada')),
  -- Execução criada quando a equipe aprova (rastreabilidade solicitação ↔ execução)
  composition_id uuid NULL REFERENCES public.proposal_compositions(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  resolved_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.umbrella_execution_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY uer_internal ON public.umbrella_execution_requests
  FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY uer_portal_insert ON public.umbrella_execution_requests
  FOR INSERT WITH CHECK (client_id = public.current_portal_client_id() AND requested_by = auth.uid());
CREATE POLICY uer_portal_read ON public.umbrella_execution_requests
  FOR SELECT USING (client_id = public.current_portal_client_id());

-- ── Sininho automático (mesmo circuito da solicitação de alteração) ────
CREATE OR REPLACE FUNCTION public.trg_execution_request_operational_alert()
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
    'portal_execution_request', 'warning', 'vendas',
    'umbrella_execution_request', NEW.id,
    'Solicitação de fornecimento — Prop. ' || coalesce(v_number, '?')
      || coalesce(' (' || v_client || ')', ''),
    coalesce(NEW.name, 'Fornecimento') || ' · ' || to_char(NEW.scheduled_date, 'DD/MM')
      || ' · ' || NEW.number_of_people || ' pessoas'
  );
  return NEW;
end;
$$;

CREATE TRIGGER trg_execution_request_alert
AFTER INSERT ON public.umbrella_execution_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_execution_request_operational_alert();

-- ── RPC do portal: solicitar fornecimento ──────────────────────────────
CREATE OR REPLACE FUNCTION public.request_umbrella_execution(
  p_proposal_id uuid,
  p_name text,
  p_scheduled_date date,
  p_scheduled_time time DEFAULT NULL,
  p_number_of_people int DEFAULT NULL,
  p_room_id uuid DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_prop record;
  v_prazo_horas numeric;
  v_req_id uuid;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Acesso não autorizado.');
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Informe o nome do evento/fornecimento.');
  END IF;
  IF p_scheduled_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Informe a data do fornecimento.');
  END IF;
  IF coalesce(p_number_of_people, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Informe o número de pessoas.');
  END IF;

  SELECT * INTO v_prop FROM public.proposals
  WHERE id = p_proposal_id AND client_id = v_client;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  END IF;
  IF NOT coalesce(v_prop.is_umbrella, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este pedido não é um contrato recorrente.');
  END IF;
  IF v_prop.status <> 'Aprovada' THEN
    RETURN jsonb_build_object('success', false, 'message', 'O contrato precisa estar confirmado para solicitar fornecimentos.');
  END IF;

  -- Sala precisa ser do próprio cliente
  IF p_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.client_rooms r WHERE r.id = p_room_id AND r.client_id = v_client
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sala inválida.');
  END IF;

  -- Mesmo prazo mínimo do resto do portal: fornecimento é operação de cozinha.
  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'portal.prazo_minimo_horas')::numeric, 24)
    INTO v_prazo_horas;
  IF (p_scheduled_date + COALESCE(p_scheduled_time, '00:00'::time))
     < ((now() AT TIME ZONE 'America/Sao_Paulo') + (v_prazo_horas || ' hours')::interval) THEN
    RETURN jsonb_build_object('success', false,
      'message', format('Fornecimentos devem ser solicitados com pelo menos %s horas de antecedência. Fale diretamente com a equipe Coffeelier.', v_prazo_horas));
  END IF;

  INSERT INTO public.umbrella_execution_requests
    (proposal_id, client_id, requested_by, name, scheduled_date, scheduled_time,
     number_of_people, room_id, location, notes)
  VALUES
    (p_proposal_id, v_client, auth.uid(), btrim(p_name), p_scheduled_date, p_scheduled_time,
     p_number_of_people, p_room_id, nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_req_id,
    'message', 'Fornecimento solicitado! Nossa equipe vai confirmar em breve.');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_umbrella_execution(uuid, text, date, time, int, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_umbrella_execution(uuid, text, date, time, int, uuid, text, text) TO authenticated;

-- ── RPC interna: aprovar a solicitação → dispara a execução real ───────
CREATE OR REPLACE FUNCTION public.approve_umbrella_execution_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req record;
  v_comp_id uuid;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode aprovar solicitações de fornecimento';
  END IF;

  SELECT * INTO v_req FROM public.umbrella_execution_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação % não encontrada', p_request_id;
  END IF;
  IF v_req.status <> 'aberta' THEN
    RAISE EXCEPTION 'Solicitação já foi % — nada a aprovar', v_req.status;
  END IF;

  -- Toda a cadeia real (composição + evento + ordens + abate) nasce aqui,
  -- pela mesma função usada no lançamento manual interno.
  v_comp_id := public.add_umbrella_execution(
    v_req.proposal_id, v_req.name, v_req.scheduled_date, v_req.scheduled_time,
    v_req.number_of_people, NULL, v_req.room_id, v_req.location, v_req.notes
  );

  UPDATE public.umbrella_execution_requests
  SET status = 'aprovada', composition_id = v_comp_id,
      resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'composition_id', v_comp_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_umbrella_execution_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_umbrella_execution_request(uuid) TO authenticated;

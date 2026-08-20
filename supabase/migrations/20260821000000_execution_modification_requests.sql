-- Alteração ESTRUTURADA de fornecimento pelo cliente (20/ago/2026, desenho
-- confirmado com o processo CMPC).
--
-- Contrato e fornecimentos são dois planos: alteração de CONTRATO (cardápio,
-- cota) segue no texto livre (request_proposal_change); alteração de UM
-- FORNECIMENTO é estruturada — só data, quantidade e sala (a composição
-- obedece o contrato) — e a confirmação da equipe executa cancelar + relançar
-- num ato atômico.
--
-- 1) umbrella_execution_requests ganha kind ('nova'|'alteracao') e
--    target_composition_id (o fornecimento sendo alterado).
-- 2) request_umbrella_execution: alvo opcional; guardas de alteração (alvo
--    vivo, não-molde, fora da janela congelada, sem solicitação duplicada).
-- 3) approve_umbrella_execution_request: alteração = cancel_umbrella_execution
--    (alvo) + add_umbrella_execution (dados novos) na mesma transação.
-- 4) get_portal_proposal expõe 'executions' (fornecimentos com status, sem a
--    molde) e o kind/target das solicitações abertas.
-- 5) Sininho/trigger diferencia o título por kind.

ALTER TABLE public.umbrella_execution_requests
  ADD COLUMN kind text NOT NULL DEFAULT 'nova' CHECK (kind IN ('nova', 'alteracao')),
  ADD COLUMN target_composition_id uuid NULL REFERENCES public.proposal_compositions(id) ON DELETE SET NULL;

-- ── 2) request_umbrella_execution com alvo opcional ────────────────────
DROP FUNCTION public.request_umbrella_execution(uuid, text, date, time, int, uuid, text, text);

CREATE OR REPLACE FUNCTION public.request_umbrella_execution(
  p_proposal_id uuid,
  p_name text,
  p_scheduled_date date,
  p_scheduled_time time DEFAULT NULL,
  p_number_of_people int DEFAULT NULL,
  p_room_id uuid DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_target_composition_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_prop record;
  v_target record;
  v_molde uuid;
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

  IF p_room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.client_rooms r WHERE r.id = p_room_id AND r.client_id = v_client
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sala inválida.');
  END IF;

  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'portal.prazo_minimo_horas')::numeric, 24)
    INTO v_prazo_horas;

  -- Alteração de fornecimento existente: guardas do alvo
  IF p_target_composition_id IS NOT NULL THEN
    SELECT pc.*, e.status AS event_status INTO v_target
    FROM public.proposal_compositions pc
    LEFT JOIN public.events e ON e.composition_id = pc.id
    WHERE pc.id = p_target_composition_id AND pc.proposal_id = p_proposal_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Fornecimento não encontrado.');
    END IF;
    SELECT t.id INTO v_molde FROM public.proposal_compositions t
    WHERE t.proposal_id = p_proposal_id ORDER BY t.sort_order ASC LIMIT 1;
    IF v_molde = p_target_composition_id THEN
      RETURN jsonb_build_object('success', false, 'message', 'A composição do contrato não pode ser alterada por aqui — use "Solicitar alteração".');
    END IF;
    IF v_target.event_status IS NULL OR v_target.event_status = 'Cancelado' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este fornecimento já foi cancelado.');
    END IF;
    IF v_target.event_status = 'Concluído' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este fornecimento já foi realizado — não pode ser alterado.');
    END IF;
    -- Janela congelada: fornecimento muito próximo não muda mais pelo portal
    IF v_target.scheduled_date IS NOT NULL AND
       (v_target.scheduled_date + COALESCE(v_target.scheduled_time, '00:00'::time))
       < ((now() AT TIME ZONE 'America/Sao_Paulo') + (v_prazo_horas || ' hours')::interval) THEN
      RETURN jsonb_build_object('success', false,
        'message', format('Este fornecimento está a menos de %s horas de antecedência e já entrou em produção. Fale diretamente com a equipe Coffeelier.', v_prazo_horas));
    END IF;
    IF EXISTS (SELECT 1 FROM public.umbrella_execution_requests r
               WHERE r.target_composition_id = p_target_composition_id AND r.status = 'aberta') THEN
      RETURN jsonb_build_object('success', false, 'message', 'Já existe uma solicitação aberta para este fornecimento — aguarde a confirmação da equipe.');
    END IF;
  END IF;

  -- Prazo mínimo também pra DATA NOVA solicitada
  IF (p_scheduled_date + COALESCE(p_scheduled_time, '00:00'::time))
     < ((now() AT TIME ZONE 'America/Sao_Paulo') + (v_prazo_horas || ' hours')::interval) THEN
    RETURN jsonb_build_object('success', false,
      'message', format('Fornecimentos devem ser solicitados com pelo menos %s horas de antecedência. Fale diretamente com a equipe Coffeelier.', v_prazo_horas));
  END IF;

  INSERT INTO public.umbrella_execution_requests
    (proposal_id, client_id, requested_by, name, scheduled_date, scheduled_time,
     number_of_people, room_id, location, notes, kind, target_composition_id)
  VALUES
    (p_proposal_id, v_client, auth.uid(), btrim(p_name), p_scheduled_date, p_scheduled_time,
     p_number_of_people, p_room_id, nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
     CASE WHEN p_target_composition_id IS NULL THEN 'nova' ELSE 'alteracao' END,
     p_target_composition_id)
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_req_id,
    'message', CASE WHEN p_target_composition_id IS NULL
      THEN 'Fornecimento solicitado! Nossa equipe vai confirmar em breve.'
      ELSE 'Alteração solicitada! Nossa equipe vai confirmar em breve.' END);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_umbrella_execution(uuid, text, date, time, int, uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_umbrella_execution(uuid, text, date, time, int, uuid, text, text, uuid) TO authenticated;

-- ── 3) Aprovação: alteração = cancelar + relançar num ato atômico ──────
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

  -- Alteração: cancela o fornecimento original primeiro (mesma transação —
  -- se qualquer passo falhar, nada muda).
  IF v_req.kind = 'alteracao' THEN
    IF v_req.target_composition_id IS NULL THEN
      RAISE EXCEPTION 'Solicitação de alteração sem fornecimento alvo';
    END IF;
    PERFORM public.cancel_umbrella_execution(v_req.target_composition_id);
  END IF;

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

-- ── 4) get_portal_proposal: fornecimentos (sem a molde) + kind/target ──
CREATE OR REPLACE FUNCTION public.get_portal_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_client uuid; v_result jsonb;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN jsonb_build_object('error','Acesso não autorizado'); END IF;
  SELECT jsonb_build_object(
    'id', p.id, 'proposal_number', p.proposal_number,
    'event_name', p.event_name, 'event_category', p.event_category,
    'number_of_people', p.number_of_people, 'event_date', p.event_date,
    'total_amount', p.total_amount, 'status', p.status,
    'created_by_client', p.created_by_client,
    'is_umbrella', p.is_umbrella,
    'umbrella_quota_quantity', p.umbrella_quota_quantity,
    'umbrella_quota_unit_price', p.umbrella_quota_unit_price,
    'has_open_change_request', EXISTS (
      SELECT 1 FROM public.proposal_change_requests pcr
      WHERE pcr.proposal_id = p.id AND pcr.status = 'aberta'
    ),
    'consumed_quantity', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc2.number_of_people), 0)
         FROM public.proposal_compositions pc2
         LEFT JOIN public.events e2 ON e2.composition_id = pc2.id
         WHERE pc2.proposal_id = p.id
           AND pc2.id <> (SELECT t.id FROM public.proposal_compositions t
                          WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e2.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'executions', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'composition_id', pc3.id, 'name', pc3.name,
          'scheduled_date', pc3.scheduled_date, 'scheduled_time', pc3.scheduled_time,
          'number_of_people', pc3.number_of_people,
          'room_id', pc3.room_id, 'room_name', r3.name, 'location', pc3.location,
          'event_status', e3.status,
          'has_open_request', EXISTS (
            SELECT 1 FROM public.umbrella_execution_requests r
            WHERE r.target_composition_id = pc3.id AND r.status = 'aberta')
        ) ORDER BY pc3.scheduled_date NULLS LAST, pc3.sort_order), '[]'::jsonb)
        FROM public.proposal_compositions pc3
        LEFT JOIN public.events e3 ON e3.composition_id = pc3.id
        LEFT JOIN public.client_rooms r3 ON r3.id = pc3.room_id
        WHERE pc3.proposal_id = p.id
          AND pc3.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      ELSE NULL END,
    'execution_requests', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', uer.id, 'name', uer.name, 'scheduled_date', uer.scheduled_date,
        'scheduled_time', uer.scheduled_time, 'number_of_people', uer.number_of_people,
        'room_name', rr.name, 'status', uer.status, 'created_at', uer.created_at,
        'kind', uer.kind, 'target_name', tc.name
      ) ORDER BY uer.scheduled_date), '[]'::jsonb)
      FROM public.umbrella_execution_requests uer
      LEFT JOIN public.client_rooms rr ON rr.id = uer.room_id
      LEFT JOIN public.proposal_compositions tc ON tc.id = uer.target_composition_id
      WHERE uer.proposal_id = p.id AND uer.status = 'aberta'
    ),
    'payment_terms', COALESCE(p.payment_terms, c.payment_terms), 'notes', p.notes,
    'client_name', c.name, 'department_id', p.department_id, 'department_name', cd.name,
    'unit_name', cu.name, 'room_name', cr.name, 'event_location_name', p.event_location_name,
    'payments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', ar.id, 'description', ar.description, 'invoice_number', ar.invoice_number,
        'due_date', ar.due_date, 'original_amount', ar.original_amount,
        'received_amount', ar.received_amount, 'remaining_amount', ar.remaining_amount,
        'status', ar.status
      ) ORDER BY ar.due_date), '[]'::jsonb)
      FROM public.accounts_receivable ar
      WHERE ar.proposal_id = p.id
    ),
    'compositions', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', comp.name, 'event_category', comp.event_category,
        'scheduled_date', comp.scheduled_date, 'scheduled_time', comp.scheduled_time,
        'location', comp.location, 'unit_id', comp.unit_id, 'room_id', comp.room_id,
        'number_of_people', COALESCE(comp.number_of_people, p.number_of_people),
        'categories', (
          SELECT jsonb_agg(jsonb_build_object('category_label', pc.category_label,
            'items', (SELECT jsonb_agg(jsonb_build_object('material_id', m.id, 'name', m.name,
                'qty_per_person', pci.qty_per_person, 'fixed_qty', pci.fixed_qty, 'unit', m.usage_unit))
              FROM public.proposal_category_items pci JOIN public.materials m ON m.id = pci.material_id
              WHERE pci.category_id = pc.id)
          ) ORDER BY pc.sort_order)
          FROM public.proposal_categories pc WHERE pc.composition_id = comp.id)
      ) ORDER BY comp.sort_order)
      FROM public.proposal_compositions comp WHERE comp.proposal_id = p.id),
    'categories_no_composition', (
      SELECT jsonb_agg(jsonb_build_object('category_label', pc.category_label,
        'items', (SELECT jsonb_agg(jsonb_build_object('material_id', m.id, 'name', m.name,
            'qty_per_person', pci.qty_per_person, 'fixed_qty', pci.fixed_qty, 'unit', m.usage_unit))
          FROM public.proposal_category_items pci JOIN public.materials m ON m.id = pci.material_id
          WHERE pci.category_id = pc.id)
      ) ORDER BY pc.sort_order)
      FROM public.proposal_categories pc WHERE pc.proposal_id = p.id AND pc.composition_id IS NULL)
  ) INTO v_result
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.client_departments cd ON cd.id = p.department_id
  LEFT JOIN public.client_units cu ON cu.id = p.unit_id
  LEFT JOIN public.client_rooms cr ON cr.id = p.room_id
  WHERE p.id = p_proposal_id AND p.client_id = v_client AND p.portal_created_by = auth.uid();
  IF v_result IS NULL THEN RETURN jsonb_build_object('error','Proposta não encontrada'); END IF;
  RETURN v_result;
END;
$function$;

-- ── 5) Sininho diferencia alteração de fornecimento ────────────────────
CREATE OR REPLACE FUNCTION public.trg_execution_request_operational_alert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
declare
  v_number text;
  v_client text;
  v_target text;
begin
  select p.proposal_number, c.name into v_number, v_client
  from public.proposals p
  left join public.clients c on c.id = p.client_id
  where p.id = NEW.proposal_id;

  if NEW.kind = 'alteracao' then
    select name into v_target from public.proposal_compositions where id = NEW.target_composition_id;
  end if;

  insert into public.operational_alerts
    (alert_type, severity, module, reference_type, reference_id, title, message)
  values (
    'portal_execution_request', 'warning', 'vendas',
    'umbrella_execution_request', NEW.id,
    case when NEW.kind = 'alteracao'
      then 'Alteração de fornecimento — Prop. ' || coalesce(v_number, '?')
        || coalesce(' (' || v_client || ')', '')
      else 'Solicitação de fornecimento — Prop. ' || coalesce(v_number, '?')
        || coalesce(' (' || v_client || ')', '') end,
    case when NEW.kind = 'alteracao'
      then coalesce(v_target, 'Fornecimento') || ' → ' || coalesce(NEW.name, '') || ' · '
        || to_char(NEW.scheduled_date, 'DD/MM') || ' · ' || NEW.number_of_people || ' pessoas'
      else coalesce(NEW.name, 'Fornecimento') || ' · ' || to_char(NEW.scheduled_date, 'DD/MM')
        || ' · ' || NEW.number_of_people || ' pessoas' end
  );
  return NEW;
end;
$$;

-- Encerramento de contrato guarda-chuva (21/ago/2026) — dois desfechos,
-- validados com o usuário:
--   'concluido' = forneceu até o fim da cota;
--   'encerrado' = interrompido antes — fatura-se o que foi fornecido e o que
--                 morre é só o SALDO A FORNECER, nunca a cobrança.
--
-- Decisão de desenho: NÃO criar status novos de proposta ('Concluída'/
-- 'Encerrada' no CHECK reverberaria em funil, filtros, RPCs do portal — e o
-- status 'Aprovada' continua verdadeiro: o contrato FOI ganho). Campos
-- próprios do contrato: umbrella_closed_at + umbrella_close_reason.
-- Reversível (reopen), na linha "nunca excluir, só desativar".
--
-- Efeitos: contrato fechado sai de Ativas/aba Contratos (front), portal e
-- equipe param de lançar execução nova (guardas abaixo), faturamento do que
-- já foi fornecido segue funcionando (nenhuma guarda em create_proposal_billing).

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS umbrella_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS umbrella_close_reason text
    CHECK (umbrella_close_reason IN ('concluido', 'encerrado'));

-- ── Fechar / reabrir ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_umbrella_contract(
  p_proposal_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop record;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode encerrar contratos';
  END IF;
  IF p_reason NOT IN ('concluido', 'encerrado') THEN
    RAISE EXCEPTION 'Desfecho inválido: % (use concluido ou encerrado)', p_reason;
  END IF;

  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada', p_proposal_id;
  END IF;
  IF NOT coalesce(v_prop.is_umbrella, false) THEN
    RAISE EXCEPTION 'Proposta % não é contrato guarda-chuva', p_proposal_id;
  END IF;
  IF v_prop.status <> 'Aprovada' THEN
    RAISE EXCEPTION 'Só contratos aprovados podem ser concluídos/encerrados (status: %)', v_prop.status;
  END IF;
  IF v_prop.umbrella_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contrato já fechado em % (%)', to_char(v_prop.umbrella_closed_at, 'DD/MM/YYYY'), v_prop.umbrella_close_reason;
  END IF;

  UPDATE public.proposals
  SET umbrella_closed_at = now(), umbrella_close_reason = p_reason, updated_at = now()
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object('success', true, 'closed_at', now(), 'reason', p_reason);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reopen_umbrella_contract(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop record;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode reabrir contratos';
  END IF;
  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada', p_proposal_id;
  END IF;
  IF v_prop.umbrella_closed_at IS NULL THEN
    RAISE EXCEPTION 'Contrato não está fechado';
  END IF;

  UPDATE public.proposals
  SET umbrella_closed_at = NULL, umbrella_close_reason = NULL, updated_at = now()
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.close_umbrella_contract(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_umbrella_contract(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reopen_umbrella_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_umbrella_contract(uuid) TO authenticated;

-- ── Guarda: equipe não lança execução em contrato fechado ──────────────
-- (mesma definição vigente + o bloco de guarda após o check de status)
CREATE OR REPLACE FUNCTION public.add_umbrella_execution(p_proposal_id uuid, p_name text, p_scheduled_date date, p_scheduled_time time without time zone DEFAULT NULL::time without time zone, p_number_of_people integer DEFAULT NULL::integer, p_price_per_person numeric DEFAULT NULL::numeric, p_room_id uuid DEFAULT NULL::uuid, p_location text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prop       record;
  v_template   record;
  v_comp_id    uuid;
  v_sort_order int;
  v_event_id   uuid;
  v_venue      text;
  v_label      text;
  v_people     int;
  v_price      numeric;
  v_et_id      uuid;
  v_epo_id     uuid;
  v_horizon    numeric;
begin
  if not public.is_internal_user() then
    raise exception 'Apenas a equipe interna pode lançar execuções';
  end if;

  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;
  if not coalesce(v_prop.is_umbrella, false) then
    raise exception 'Proposta % não é guarda-chuva (is_umbrella = false)', p_proposal_id;
  end if;
  if v_prop.status <> 'Aprovada' then
    raise exception 'Proposta guarda-chuva precisa estar Aprovada para lançar execuções (status atual: %)', v_prop.status;
  end if;
  -- Contrato fechado não recebe execução nova (reabra primeiro se for engano)
  if v_prop.umbrella_closed_at is not null then
    raise exception 'Contrato já % em % — reabra o contrato para lançar novas execuções',
      case when v_prop.umbrella_close_reason = 'concluido' then 'concluído' else 'encerrado' end,
      to_char(v_prop.umbrella_closed_at, 'DD/MM/YYYY');
  end if;

  -- Composição-molde = a de menor sort_order (criada na aprovação original).
  select * into v_template from public.proposal_compositions
    where proposal_id = p_proposal_id order by sort_order asc limit 1;
  if not found then
    raise exception 'Proposta % não tem composição-molde para copiar itens', p_proposal_id;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.proposal_compositions where proposal_id = p_proposal_id;

  v_people := coalesce(p_number_of_people, v_template.number_of_people, 0);
  -- UMA cadeia de preço pra composição E pro evento (antes divergiam).
  v_price  := coalesce(p_price_per_person, v_prop.umbrella_quota_unit_price, v_template.price_per_person, 0);

  insert into public.proposal_compositions (
    proposal_id, name, event_category, scheduled_date, scheduled_time,
    room_id, location, number_of_people, price_per_person, sort_order, notes, service_code
  ) values (
    p_proposal_id,
    coalesce(nullif(trim(p_name), ''), 'Execução ' || v_sort_order),
    v_template.event_category,
    p_scheduled_date,
    p_scheduled_time,
    coalesce(p_room_id, v_template.room_id),
    coalesce(p_location, v_template.location),
    v_people,
    v_price,
    v_sort_order,
    p_notes,
    v_template.service_code
  ) returning id into v_comp_id;

  insert into public.proposal_categories (proposal_id, composition_id, category_label, sort_order)
  select p_proposal_id, v_comp_id, pc.category_label, pc.sort_order
  from public.proposal_categories pc
  where pc.composition_id = v_template.id;

  insert into public.proposal_category_items (category_id, material_id, qty_per_person, fixed_qty, item_kind, unit_override)
  select new_pc.id, pci.material_id, pci.qty_per_person, pci.fixed_qty, pci.item_kind, pci.unit_override
  from public.proposal_category_items pci
  join public.proposal_categories old_pc on old_pc.id = pci.category_id
  join public.proposal_categories new_pc
    on new_pc.composition_id = v_comp_id and new_pc.category_label = old_pc.category_label
  where old_pc.composition_id = v_template.id;

  v_venue := coalesce(
    (select name from public.client_rooms where id = coalesce(p_room_id, v_template.room_id)),
    nullif(trim(coalesce(p_location, v_template.location, '')), '')
  );
  v_label := coalesce(nullif(trim(v_prop.event_name), '') || ' · ', '')
             || coalesce(nullif(trim(p_name), ''), 'Execução')
             || ' — Prop. ' || v_prop.proposal_number;

  insert into public.events (
    proposal_id, composition_id, client_id, event_name, event_date, setup_time, venue,
    total_people, total_amount, event_duration, status
  ) values (
    p_proposal_id, v_comp_id, v_prop.client_id,
    v_label, p_scheduled_date, p_scheduled_time, v_venue,
    v_people, v_price * v_people,
    4, 'Agendado'
  ) returning id into v_event_id;

  perform public.create_event_notifications(v_event_id);

  insert into public.event_tables (event_code, client_name, client_id, date_start, date_end, attendees, status, notes, proposal_id)
  values (
    'EVT-' || v_prop.proposal_number || '-EX' || v_sort_order,
    (select name from public.clients where id = v_prop.client_id),
    v_prop.client_id, p_scheduled_date, p_scheduled_date, v_people, 'draft',
    'Execução guarda-chuva de ' || v_prop.proposal_number, p_proposal_id
  ) returning id into v_et_id;

  insert into public.event_production_orders (event_table_id, composition_id, order_code, status, scheduled_start, notes)
  values (
    v_et_id, v_comp_id,
    'OE-' || v_prop.proposal_number || '-EX' || v_sort_order, 'Planejado',
    (coalesce(p_scheduled_date, current_date)::text || ' ' || coalesce(p_scheduled_time::text, '00:00:00'))::timestamptz,
    coalesce(nullif(trim(p_name), ''), 'Execução')
  ) returning id into v_epo_id;

  insert into public.event_production_order_items (order_id, material_id, planned_qty, planned_unit, kind, position)
  select v_epo_id, pci.material_id,
         coalesce(pci.fixed_qty, pci.qty_per_person * v_people),
         coalesce(pci.unit_override, m.usage_unit),
         case when m.material_type in ('finished_product','intermediate_product','composite_product') then 'produce_finished'
              when m.material_type = 'packaging' then 'packaging_only'
              else 'pick_resale' end,
         row_number() over ()
  from public.proposal_category_items pci
  join public.proposal_categories pc on pc.id = pci.category_id
  join public.materials m on m.id = pci.material_id
  where pc.composition_id = v_comp_id;

  -- Ordem de PRODUÇÃO só na véspera (zona congelada): a Ordem de Evento acima
  -- sinaliza o evento futuro; a produção congela quando o evento entra na
  -- janela producao.execucao_antecedencia_horas (cron gera de hora em hora).
  -- Aqui só gera se o evento JÁ está dentro da janela (ex.: relançamento após
  -- cancelar uma execução próxima).
  select coalesce((select value from public.app_settings where key = 'producao.execucao_antecedencia_horas')::numeric, 48)
    into v_horizon;
  if (p_scheduled_date + coalesce(p_scheduled_time, '00:00'::time))
     <= ((now() at time zone 'America/Sao_Paulo') + (v_horizon || ' hours')::interval) then
    perform public.generate_umbrella_execution_production(v_comp_id);
  end if;

  return v_comp_id;
end;
$function$;

-- ── Guarda: portal não solicita fornecimento em contrato fechado ───────
-- (mesma definição vigente + o bloco de guarda após o check de status)
CREATE OR REPLACE FUNCTION public.request_umbrella_execution(p_proposal_id uuid, p_name text, p_scheduled_date date, p_scheduled_time time without time zone DEFAULT NULL::time without time zone, p_number_of_people integer DEFAULT NULL::integer, p_room_id uuid DEFAULT NULL::uuid, p_location text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_target_composition_id uuid DEFAULT NULL::uuid)
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
  IF v_prop.umbrella_closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message',
      CASE WHEN v_prop.umbrella_close_reason = 'concluido'
        THEN 'Este contrato foi concluído — não aceita novos fornecimentos. Fale com a equipe Coffeelier.'
        ELSE 'Este contrato foi encerrado — não aceita novos fornecimentos. Fale com a equipe Coffeelier.' END);
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

-- ── Portal enxerga o fechamento (esconde "Solicitar fornecimento") ─────
-- (mesma definição vigente + os 2 campos umbrella_closed_at/close_reason)
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
    'umbrella_closed_at', p.umbrella_closed_at,
    'umbrella_close_reason', p.umbrella_close_reason,
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
    'consumed_value', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc2b.number_of_people * coalesce(pc2b.price_per_person, 0)), 0)
         FROM public.proposal_compositions pc2b
         LEFT JOIN public.events e2b ON e2b.composition_id = pc2b.id
         WHERE pc2b.proposal_id = p.id
           AND pc2b.id <> (SELECT t.id FROM public.proposal_compositions t
                           WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e2b.status IS DISTINCT FROM 'Cancelado')
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

-- ── get_umbrella_progress devolve o fechamento (painel interno) ────────
CREATE OR REPLACE FUNCTION public.get_umbrella_progress(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop     record;
  v_template record;
  v_health   jsonb;
  v_result   jsonb;
begin
  if not public.is_internal_user() then
    raise exception 'Acesso restrito à equipe interna';
  end if;

  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;

  select id, name, price_per_person, number_of_people into v_template
  from public.proposal_compositions
  where proposal_id = p_proposal_id
  order by sort_order asc
  limit 1;

  -- Saúde: custo unitário da molde HOJE (mesma cadeia de custo do editor) +
  -- custo unitário na assinatura (snapshot da última revisão enviada).
  select jsonb_build_object(
    'contract_unit_price', coalesce(v_prop.umbrella_quota_unit_price, v_template.price_per_person),
    'unit_cost_today', coalesce(sum(
      (coalesce(pci.qty_per_person, 0)
        + coalesce(coalesce(pci.fixed_qty, 0) / nullif(coalesce(v_template.number_of_people, 0), 0), 0))
      * coalesce(rb.cached_unit_cost, si.average_price, m.cost_price, 0)
    ), 0),
    'signing_unit_cost', (
      select pr.total_cost / nullif(pr.number_of_people, 0)
      from public.proposal_revisions pr
      where pr.proposal_id = p_proposal_id
      order by pr.revision desc limit 1
    ),
    'signing_revision', (
      select max(pr.revision) from public.proposal_revisions pr
      where pr.proposal_id = p_proposal_id
    )
  ) into v_health
  from public.proposal_category_items pci
  join public.proposal_categories pc on pc.id = pci.category_id
  join public.materials m on m.id = pci.material_id
  left join public.stock_items si on si.material_id = m.id
  left join lateral (
    select cached_unit_cost from public.recipes_bom rb2
    where rb2.finished_material_id = m.id and coalesce(rb2.is_archived, false) = false
    limit 1
  ) rb on true
  where pc.composition_id = v_template.id;

  select jsonb_build_object(
    'quota_quantity', v_prop.umbrella_quota_quantity,
    'quota_unit_price', v_prop.umbrella_quota_unit_price,
    'quota_value_total', coalesce(v_prop.umbrella_quota_quantity, 0) * coalesce(v_prop.umbrella_quota_unit_price, 0),
    'template_name', v_template.name,
    'template_price_per_person', v_template.price_per_person,
    'health', v_health,
    'closed_at', v_prop.umbrella_closed_at,
    'close_reason', v_prop.umbrella_close_reason,
    'consumed_quantity', coalesce(agg.consumed_quantity, 0),
    'consumed_value', coalesce(agg.consumed_value, 0),
    'remaining_quantity', coalesce(v_prop.umbrella_quota_quantity, 0) - coalesce(agg.consumed_quantity, 0),
    'remaining_value', (coalesce(v_prop.umbrella_quota_quantity, 0) * coalesce(v_prop.umbrella_quota_unit_price, 0)) - coalesce(agg.consumed_value, 0),
    'executions', coalesce(agg.executions, '[]'::jsonb)
  ) into v_result
  from (
    select
      -- Cancelada fica no extrato (com badge), mas fora do consumo
      sum(pc.number_of_people) filter (where e.status is distinct from 'Cancelado') as consumed_quantity,
      sum(pc.number_of_people * coalesce(pc.price_per_person, 0)) filter (where e.status is distinct from 'Cancelado') as consumed_value,
      jsonb_agg(jsonb_build_object(
        'composition_id', pc.id,
        'name', pc.name,
        'scheduled_date', pc.scheduled_date,
        'scheduled_time', pc.scheduled_time,
        'number_of_people', pc.number_of_people,
        'price_per_person', pc.price_per_person,
        'value', coalesce(pc.number_of_people, 0) * coalesce(pc.price_per_person, 0),
        'event_id', e.id,
        'event_status', e.status
      ) order by pc.sort_order) as executions
    from public.proposal_compositions pc
    left join public.events e on e.composition_id = pc.id
    where pc.proposal_id = p_proposal_id
      and pc.id is distinct from v_template.id
  ) agg;

  return v_result;
end;
$function$;

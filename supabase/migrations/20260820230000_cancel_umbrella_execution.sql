-- Cancelamento de execução de guarda-chuva (20/ago/2026).
--
-- Caso real CMPC: cliente pede pra mudar data/quantidade/sala de um
-- fornecimento JÁ CONFIRMADO. O modelo de alteração é cancelar + relançar
-- (nunca editar no lugar — preserva histórico e reusa a cadeia testada de
-- add_umbrella_execution). Este é o elo que faltava: a equipe não tinha como
-- cancelar uma execução.
--
-- 1) cancel_umbrella_execution(composition_id): cancela evento + Ordem de
--    Evento + Ordem de Produção da execução (BPO achada pelo nome
--    determinístico PROD-<número>-EX<ordem>, só se ainda Planejado). Guardas:
--    interno, guarda-chuva, nunca a molde, nunca execução Concluída.
-- 2) Consumo passa a IGNORAR execuções canceladas em todas as pontas:
--    get_umbrella_progress (extrato mantém a linha, com badge Cancelado),
--    get_portal_proposal/s (consumido + próximas/últimas datas) e
--    get_portal_my_events (some do calendário do cliente).

-- ── 1) cancel_umbrella_execution ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_umbrella_execution(p_composition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comp record;
  v_prop record;
  v_molde uuid;
  v_event record;
  v_epo int := 0;
  v_bpo int := 0;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode cancelar execuções';
  END IF;

  SELECT * INTO v_comp FROM public.proposal_compositions WHERE id = p_composition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execução % não encontrada', p_composition_id;
  END IF;
  SELECT * INTO v_prop FROM public.proposals WHERE id = v_comp.proposal_id;
  IF NOT coalesce(v_prop.is_umbrella, false) THEN
    RAISE EXCEPTION 'Proposta não é guarda-chuva';
  END IF;
  SELECT id INTO v_molde FROM public.proposal_compositions
  WHERE proposal_id = v_comp.proposal_id ORDER BY sort_order ASC LIMIT 1;
  IF v_molde = p_composition_id THEN
    RAISE EXCEPTION 'A composição-molde (cardápio do contrato) não pode ser cancelada';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE composition_id = p_composition_id;
  IF FOUND THEN
    IF v_event.status = 'Concluído' THEN
      RAISE EXCEPTION 'Execução já concluída — não pode ser cancelada';
    END IF;
    IF v_event.status = 'Cancelado' THEN
      RAISE EXCEPTION 'Execução já está cancelada';
    END IF;
    UPDATE public.events SET status = 'Cancelado' WHERE id = v_event.id;
  END IF;

  UPDATE public.event_production_orders
  SET status = 'Cancelado'
  WHERE composition_id = p_composition_id AND status NOT IN ('Concluído', 'Cancelado');
  GET DIAGNOSTICS v_epo = ROW_COUNT;

  -- BPO da execução tem nome determinístico (add_umbrella_execution); só
  -- cancela se ainda Planejado — em produção/concluída fica pro time decidir.
  UPDATE public.bom_production_orders
  SET status = 'Cancelado'
  WHERE order_name = 'PROD-' || v_prop.proposal_number || '-EX' || v_comp.sort_order
    AND status = 'Planejado';
  GET DIAGNOSTICS v_bpo = ROW_COUNT;

  RETURN jsonb_build_object('success', true,
    'event_cancelled', v_event.id IS NOT NULL,
    'event_orders_cancelled', v_epo,
    'production_orders_cancelled', v_bpo);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_umbrella_execution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_umbrella_execution(uuid) TO authenticated;

-- ── 2a) get_umbrella_progress: canceladas fora do consumo ──────────────
CREATE OR REPLACE FUNCTION public.get_umbrella_progress(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop     record;
  v_template record;
  v_result   jsonb;
begin
  if not public.is_internal_user() then
    raise exception 'Acesso restrito à equipe interna';
  end if;

  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;

  select id, name, price_per_person into v_template
  from public.proposal_compositions
  where proposal_id = p_proposal_id
  order by sort_order asc
  limit 1;

  select jsonb_build_object(
    'quota_quantity', v_prop.umbrella_quota_quantity,
    'quota_unit_price', v_prop.umbrella_quota_unit_price,
    'quota_value_total', coalesce(v_prop.umbrella_quota_quantity, 0) * coalesce(v_prop.umbrella_quota_unit_price, 0),
    'template_name', v_template.name,
    'template_price_per_person', v_template.price_per_person,
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

-- ── 2b) get_portal_proposal: consumido ignora canceladas ───────────────
-- (substitui só o cálculo de consumed_quantity; demais campos inalterados)
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
    'execution_requests', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', uer.id, 'name', uer.name, 'scheduled_date', uer.scheduled_date,
        'scheduled_time', uer.scheduled_time, 'number_of_people', uer.number_of_people,
        'room_name', rr.name, 'status', uer.status, 'created_at', uer.created_at
      ) ORDER BY uer.scheduled_date), '[]'::jsonb)
      FROM public.umbrella_execution_requests uer
      LEFT JOIN public.client_rooms rr ON rr.id = uer.room_id
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

-- ── 2c) get_portal_proposals: consumido/datas ignoram canceladas ───────
CREATE OR REPLACE FUNCTION public.get_portal_proposals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_result jsonb;
  v_today  date := (now() at time zone 'America/Sao_Paulo')::date;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'proposal_number', p.proposal_number,
    'event_name', p.event_name, 'event_category', p.event_category,
    'event_date', p.event_date, 'number_of_people', p.number_of_people,
    'total_amount', p.total_amount, 'status', p.status, 'created_at', p.created_at,
    'created_by_client', p.created_by_client,
    'is_umbrella', p.is_umbrella,
    'umbrella_quota_quantity', p.umbrella_quota_quantity,
    'umbrella_quota_unit_price', p.umbrella_quota_unit_price,
    'has_open_change_request', EXISTS (
      SELECT 1 FROM public.proposal_change_requests pcr
      WHERE pcr.proposal_id = p.id AND pcr.status = 'aberta'
    ),
    'consumed_quantity', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc.number_of_people), 0)
         FROM public.proposal_compositions pc
         LEFT JOIN public.events e ON e.composition_id = pc.id
         WHERE pc.proposal_id = p.id
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'next_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT min(pc.scheduled_date) FROM public.proposal_compositions pc
         LEFT JOIN public.events e ON e.composition_id = pc.id
         WHERE pc.proposal_id = p.id AND pc.scheduled_date >= v_today
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'last_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT max(pc.scheduled_date) FROM public.proposal_compositions pc
         LEFT JOIN public.events e ON e.composition_id = pc.id
         WHERE pc.proposal_id = p.id
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'payment_summary', (
      SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
        'billed_total', COALESCE(sum(ar.original_amount), 0),
        'open_amount', COALESCE(sum(ar.remaining_amount) FILTER (WHERE ar.status IN ('Pendente','Parcial','Vencido') AND ar.remaining_amount > 0), 0),
        'overdue_amount', COALESCE(sum(ar.remaining_amount) FILTER (WHERE ar.status = 'Vencido' AND ar.remaining_amount > 0), 0),
        'next_due_date', min(ar.due_date) FILTER (WHERE ar.status IN ('Pendente','Parcial','Vencido') AND ar.remaining_amount > 0),
        'payment_status', CASE
          WHEN count(*) FILTER (WHERE ar.status = 'Vencido' AND ar.remaining_amount > 0) > 0 THEN 'Vencido'
          WHEN count(*) FILTER (WHERE ar.status IN ('Pendente','Parcial') AND ar.remaining_amount > 0) > 0 THEN 'Em aberto'
          ELSE 'Pago' END
      ) END
      FROM public.accounts_receivable ar
      WHERE ar.proposal_id = p.id AND ar.status <> 'Cancelado'
    )
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.proposals p
  WHERE p.client_id = v_client AND p.portal_created_by = auth.uid();
  RETURN v_result;
END;
$function$;

-- ── 2d) get_portal_my_events: cancelados fora do calendário do cliente ─
CREATE OR REPLACE FUNCTION public.get_portal_my_events()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_client uuid; v_result jsonb;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_id', e.id, 'proposal_id', e.proposal_id,
    'event_name', e.event_name, 'event_date', e.event_date,
    'setup_time', e.setup_time, 'venue', e.venue, 'status', e.status,
    'total_people', e.total_people
  ) ORDER BY e.event_date), '[]'::jsonb)
  INTO v_result
  FROM public.events e
  JOIN public.proposals p ON p.id = e.proposal_id
  WHERE p.client_id = v_client
    AND p.portal_created_by = auth.uid()
    AND e.event_date IS NOT NULL
    AND e.status <> 'Cancelado';
  RETURN v_result;
END;
$function$;

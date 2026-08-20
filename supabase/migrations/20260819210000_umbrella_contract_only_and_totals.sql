-- Guarda-chuva: aprovação vira "ativar contrato" (sem gerar evento/ordens) e a
-- composição-molde deixa de contar como execução (19/ago/2026, achados do teste
-- ao vivo com o processo real da CMPC).
--
-- Motivação de negócio: a rotina recorrente é aprovada SEM data — a cotação
-- decide *se* a rotina roda; a data do 1º fornecimento chega dias/semanas
-- depois ("hoje tem evento na sala tal"). Aprovação do contrato e primeira
-- execução real são dois momentos distintos que o modelo anterior colava num
-- só (a molde virava evento na hora da aprovação, exigindo data placeholder).
--
-- 1) create_event_from_proposal / generate_production_from_proposal ganham
--    guarda is_umbrella ANTES de qualquer delete/insert. Além do modelo novo,
--    isso fecha uma brecha real: os deletes de idempotência dessas funções
--    apagariam eventos/ordens de execuções JÁ LANÇADAS (checklist/anexos caem
--    junto por ON DELETE CASCADE) se alguém reaprovasse — hoje só o
--    SalesPipeline.tsx se protege, na tela; a RPC em si não se protegia.
--    Toda ocorrência real — inclusive a 1ª — nasce por add_umbrella_execution.
-- 2) get_umbrella_progress: molde (menor sort_order, mesmo critério do
--    add_umbrella_execution) sai do consumo e do extrato; devolve
--    template_name/template_price_per_person pro front usar de fallback de
--    preço (o dialog de lançamento usava executions[0], que era a molde).
-- 3) get_portal_proposal / get_portal_proposals: mesma exclusão da molde em
--    consumed_quantity / next_execution_date / last_execution_date.
-- 4) get_portal_proposal_pdf: expõe is_umbrella/cota (o PDF do portal passa a
--    mostrar quantidade contratada × preço unitário = valor total).

-- ── 1a) create_event_from_proposal: guarda is_umbrella ─────────────────
CREATE OR REPLACE FUNCTION public.create_event_from_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop   record;
  v_comp   record;
  v_people int;
  v_venue  text;
  v_label  text;
  v_eid    uuid;
  v_count  int := 0;
begin
  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;

  -- Guarda-chuva: aprovação apenas ativa o contrato — nenhum evento nasce aqui.
  -- Também protege as execuções já lançadas: o delete de idempotência abaixo as
  -- apagaria (checklist/anexos/notificações caem junto por CASCADE).
  if coalesce(v_prop.is_umbrella, false) then
    return jsonb_build_object('status', 'skipped', 'reason', 'umbrella_contract_only');
  end if;

  -- Idempotência: regenera os eventos desta proposta
  delete from public.events where proposal_id = p_proposal_id;

  -- Um evento na agenda por COMPOSIÇÃO (momento), com data/hora/local próprios
  for v_comp in
    select * from public.proposal_compositions
    where proposal_id = p_proposal_id
    order by sort_order
  loop
    v_people := coalesce(v_comp.number_of_people, v_prop.number_of_people, 0);
    v_venue := coalesce(
      (select name from public.client_rooms where id = v_comp.room_id),
      nullif(trim(coalesce(v_comp.location, '')), '')
    );
    v_label := coalesce(nullif(trim(v_prop.event_name), '') || ' · ', '')
               || coalesce(nullif(trim(v_comp.name), ''), 'Momento')
               || ' — Prop. ' || v_prop.proposal_number;

    insert into public.events (
      proposal_id, composition_id, client_id, event_name, event_date, setup_time, venue,
      total_people, total_amount, event_duration, status
    ) values (
      p_proposal_id, v_comp.id, v_prop.client_id,
      v_label,
      coalesce(v_comp.scheduled_date, v_prop.event_date),
      v_comp.scheduled_time,
      v_venue,
      v_people,
      coalesce(v_comp.price_per_person, 0) * v_people,
      4,
      'Agendado'
    ) returning id into v_eid;

    perform public.create_event_notifications(v_eid);
    v_count := v_count + 1;
  end loop;

  -- Fallback: proposta sem composições -> 1 evento da proposta
  if v_count = 0 then
    insert into public.events (
      proposal_id, client_id, event_name, event_date,
      total_people, total_amount, event_duration, status
    ) values (
      p_proposal_id, v_prop.client_id,
      coalesce(nullif(trim(v_prop.event_name), ''), 'Evento') || ' — Prop. ' || v_prop.proposal_number,
      v_prop.event_date, v_prop.number_of_people,
      coalesce(v_prop.total_amount, 0), 4, 'Agendado'
    ) returning id into v_eid;
    perform public.create_event_notifications(v_eid);
    v_count := 1;
  end if;

  return jsonb_build_object('status', 'success', 'events_created', v_count);
end;
$function$;

-- ── 1b) generate_production_from_proposal: guarda is_umbrella ──────────
CREATE OR REPLACE FUNCTION public.generate_production_from_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop      record;
  v_comp      record;
  v_et_id     uuid;
  v_epo_id    uuid;
  v_bpo_id    uuid := null;
  v_people    int;
  v_evt_orders int := 0;
  v_def_count int := 0;
begin
  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then raise exception 'Proposta % não encontrada', p_proposal_id; end if;

  -- Guarda-chuva: aprovação apenas ativa o contrato — nenhuma ordem nasce aqui.
  -- Também protege as execuções já lançadas: os deletes de idempotência abaixo
  -- apagariam as ordens delas.
  if coalesce(v_prop.is_umbrella, false) then
    return jsonb_build_object('status', 'skipped', 'reason', 'umbrella_contract_only');
  end if;

  -- ── IDEMPOTÊNCIA ──
  delete from public.event_production_order_items
    where order_id in (select id from public.event_production_orders
                       where event_table_id in (select id from public.event_tables where proposal_id = p_proposal_id));
  delete from public.event_production_orders
    where event_table_id in (select id from public.event_tables where proposal_id = p_proposal_id);
  delete from public.event_tables where proposal_id = p_proposal_id;
  if v_prop.auto_generated_bom_order_id is not null then
    delete from public.bom_production_order_items where production_order_id = v_prop.auto_generated_bom_order_id;
    delete from public.bom_production_orders where id = v_prop.auto_generated_bom_order_id;
  end if;

  -- ── 1) event_table ──
  insert into public.event_tables (event_code, client_name, client_id, date_start, date_end, attendees, status, notes, proposal_id)
  values (
    'EVT-' || v_prop.proposal_number,
    (select name from public.clients where id = v_prop.client_id),
    v_prop.client_id,
    coalesce((select min(scheduled_date) from public.proposal_compositions where proposal_id = p_proposal_id), v_prop.event_date, current_date),
    coalesce((select max(scheduled_date) from public.proposal_compositions where proposal_id = p_proposal_id), v_prop.event_date, current_date),
    v_prop.number_of_people, 'draft', 'Gerado da proposta ' || v_prop.proposal_number, p_proposal_id
  ) returning id into v_et_id;

  -- ── 2) ORDEM DE EVENTO (separação) por COMPOSIÇÃO ──
  for v_comp in select * from public.proposal_compositions where proposal_id = p_proposal_id order by sort_order loop
    v_people := coalesce(v_comp.number_of_people, v_prop.number_of_people, 0);
    insert into public.event_production_orders (event_table_id, composition_id, order_code, status, scheduled_start, notes)
    values (
      v_et_id, v_comp.id, 'OE-' || v_prop.proposal_number || '-' || (v_evt_orders + 1), 'Planejado',
      (coalesce(v_comp.scheduled_date, v_prop.event_date, current_date)::text || ' ' || coalesce(v_comp.scheduled_time::text, '00:00:00'))::timestamptz,
      coalesce(nullif(trim(v_comp.name), ''), 'Momento')
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
    where pc.composition_id = v_comp.id;

    v_evt_orders := v_evt_orders + 1;
  end loop;

  -- ── 3) ORDEM DE PRODUÇÃO (déficit vs estoque) ──
  create temp table _deficit on commit drop as
  select d.bom_id, d.yield_quantity, d.yield_unit, d.deficit_qty,
         greatest(1, ceil(d.deficit_qty / nullif(d.yield_quantity, 0))::int) as batches
  from (
    select rb.id as bom_id, rb.yield_quantity, rb.yield_unit,
           (n.needed - coalesce(si.current_quantity, 0)) as deficit_qty
    from (
      select pci.material_id,
             sum(coalesce(pci.fixed_qty, pci.qty_per_person * coalesce(comp.number_of_people, v_prop.number_of_people, 0))) as needed
      from public.proposal_category_items pci
      join public.proposal_categories pc on pc.id = pci.category_id
      join public.proposal_compositions comp on comp.id = pc.composition_id
      where pc.proposal_id = p_proposal_id
      group by pci.material_id
    ) n
    join public.recipes_bom rb on rb.finished_material_id = n.material_id and coalesce(rb.is_archived, false) = false
    left join public.stock_items si on si.material_id = n.material_id
  ) d
  where d.deficit_qty > 0;

  select count(*) into v_def_count from _deficit;

  if v_def_count > 0 then
    insert into public.bom_production_orders (order_name, order_date, status, notes, created_by)
    values ('PROD-' || v_prop.proposal_number,
            coalesce((select min(scheduled_date) from public.proposal_compositions where proposal_id = p_proposal_id), v_prop.event_date, current_date),
            'Planejado', 'Produção do déficit da proposta ' || v_prop.proposal_number || ' (após checagem de estoque)', auth.uid())
    returning id into v_bpo_id;

    insert into public.bom_production_order_items
      (production_order_id, bom_id, quantity, multiplier, total_yield_quantity, yield_unit, position)
    select v_bpo_id, bom_id, batches, batches::numeric, batches * coalesce(yield_quantity, 0), coalesce(yield_unit, 'un'), row_number() over ()
    from _deficit;

    update public.proposals set auto_generated_bom_order_id = v_bpo_id, updated_at = now() where id = p_proposal_id;
  end if;

  update public.proposals set auto_generated_event_table_id = v_et_id, updated_at = now() where id = p_proposal_id;

  return jsonb_build_object('status','success','event_table_id',v_et_id,'ordens_de_evento',v_evt_orders,
                            'itens_em_deficit_para_producao',v_def_count,'bom_order_id',v_bpo_id);
end;
$function$;

-- ── 2) get_umbrella_progress: molde fora do consumo/extrato ────────────
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

  -- Composição-molde (menor sort_order, mesmo critério de add_umbrella_execution):
  -- é o cardápio-template do contrato, não uma execução — fica fora do consumo.
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
      sum(pc.number_of_people) as consumed_quantity,
      sum(pc.number_of_people * coalesce(pc.price_per_person, 0)) as consumed_value,
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

-- ── 3a) get_portal_proposal: molde fora do consumo ─────────────────────
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
    'consumed_quantity', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc2.number_of_people), 0)
         FROM public.proposal_compositions pc2
         WHERE pc2.proposal_id = p.id
           AND pc2.id <> (SELECT t.id FROM public.proposal_compositions t
                          WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      ELSE NULL END,
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

-- ── 3b) get_portal_proposals: molde fora do consumo/datas de execução ──
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
    'consumed_quantity', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc.number_of_people), 0)
         FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      ELSE NULL END,
    'next_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT min(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id AND pc.scheduled_date >= v_today
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      ELSE NULL END,
    'last_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT max(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id
           AND pc.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
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

-- ── 4) get_portal_proposal_pdf: expõe cota do guarda-chuva ─────────────
CREATE OR REPLACE FUNCTION public.get_portal_proposal_pdf(p_proposal_id uuid)
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
    'proposal', jsonb_build_object(
      'id', p.id, 'proposal_number', p.proposal_number, 'revision', p.revision,
      'event_name', p.event_name, 'event_category', p.event_category,
      'number_of_people', p.number_of_people, 'event_date', p.event_date,
      'total_amount', p.total_amount, 'target_weight_per_person', p.target_weight_per_person,
      'status', p.status, 'payment_terms', p.payment_terms,
      'is_umbrella', p.is_umbrella,
      'umbrella_quota_quantity', p.umbrella_quota_quantity,
      'umbrella_quota_unit_price', p.umbrella_quota_unit_price,
      'clients', jsonb_build_object('name', c.name, 'cnpj_cpf', c.cnpj_cpf, 'payment_terms', c.payment_terms),
      'client_departments', CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object('name', cd.name) END,
      'client_units', CASE WHEN cu.id IS NULL THEN NULL ELSE jsonb_build_object('name', cu.name, 'address', cu.address) END,
      'client_rooms', CASE WHEN cr.id IS NULL THEN NULL ELSE jsonb_build_object('name', cr.name) END,
      'client_contacts', CASE WHEN cc.id IS NULL THEN NULL ELSE jsonb_build_object('name', cc.name, 'email', cc.email, 'phone', cc.phone) END
    ),
    'compositions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', comp.id, 'name', comp.name, 'event_category', comp.event_category,
        'scheduled_date', comp.scheduled_date, 'scheduled_time', comp.scheduled_time,
        'location', comp.location, 'sort_order', comp.sort_order,
        'price_per_person', comp.price_per_person, 'number_of_people', comp.number_of_people,
        'service_code', comp.service_code,
        'client_rooms', CASE WHEN compr.id IS NULL THEN NULL ELSE jsonb_build_object('name', compr.name) END
      ) ORDER BY comp.sort_order), '[]'::jsonb)
      FROM public.proposal_compositions comp
      LEFT JOIN public.client_rooms compr ON compr.id = comp.room_id
      WHERE comp.proposal_id = p.id
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category_label', pc.category_label, 'sort_order', pc.sort_order, 'composition_id', pc.composition_id,
        'proposal_category_items', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'qty_per_person', pci.qty_per_person, 'fixed_qty', pci.fixed_qty,
            'materials', jsonb_build_object('name', m.name, 'usage_unit', m.usage_unit, 'unit_weight', m.unit_weight, 'category', m.category)
          )), '[]'::jsonb)
          FROM public.proposal_category_items pci JOIN public.materials m ON m.id = pci.material_id
          WHERE pci.category_id = pc.id
        )
      ) ORDER BY pc.sort_order), '[]'::jsonb)
      FROM public.proposal_categories pc WHERE pc.proposal_id = p.id
    )
  ) INTO v_result
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.client_departments cd ON cd.id = p.department_id
  LEFT JOIN public.client_units cu ON cu.id = p.unit_id
  LEFT JOIN public.client_rooms cr ON cr.id = p.room_id
  LEFT JOIN public.client_contacts cc ON cc.id = p.contact_id
  WHERE p.id = p_proposal_id AND p.client_id = v_client AND p.portal_created_by = auth.uid();

  IF v_result IS NULL THEN RETURN jsonb_build_object('error','Proposta não encontrada'); END IF;
  RETURN v_result;
END;
$function$;

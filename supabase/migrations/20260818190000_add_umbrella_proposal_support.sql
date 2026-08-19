-- Proposta guarda-chuva (cota recorrente): schema + RPCs aditivas.
--
-- Contexto: propostas hoje são "aprova uma vez, tudo fixo" — persistAll/
-- create_event_from_proposal/generate_production_from_proposal apagam e
-- recriam tudo a cada chamada (idempotência por "wipe and regenerate").
-- Isso é seguro pro fluxo normal (editar antes de aprovar), mas destruiria
-- histórico (checklist/anexos/notificações têm ON DELETE CASCADE em
-- events.id) se reaproveitado pra ir adicionando execuções mês a mês numa
-- proposta guarda-chuva já aprovada e em andamento (ex.: CMPC).
--
-- Por isso as funções novas abaixo são estritamente aditivas (só INSERT),
-- nunca tocam/apagam composições ou eventos já existentes.

-- ── 1) Schema ──────────────────────────────────────────────────────────

ALTER TABLE public.proposals
  ADD COLUMN is_umbrella boolean NOT NULL DEFAULT false,
  ADD COLUMN umbrella_quota_quantity numeric,
  ADD COLUMN umbrella_quota_unit_price numeric;

COMMENT ON COLUMN public.proposals.is_umbrella IS
  'Proposta guarda-chuva: aprovada uma vez, execuções lançadas ao longo do tempo via add_umbrella_execution (nunca reaberta no editor normal).';
COMMENT ON COLUMN public.proposals.umbrella_quota_quantity IS
  'Quantidade total contratada (ex.: 1000 pessoas/ano). Consumida pela soma de proposal_compositions.number_of_people.';
COMMENT ON COLUMN public.proposals.umbrella_quota_unit_price IS
  'Preço de referência por unidade (ex.: R$18/pessoa), usado para derivar o valor total da cota e pré-preencher novas execuções.';

-- events só tinha proposal_id — não dava pra saber qual evento veio de qual
-- composição/execução sem casar por nome. Nullable, só populada pelo
-- caminho novo; não afeta nenhum evento existente.
ALTER TABLE public.events
  ADD COLUMN composition_id uuid REFERENCES public.proposal_compositions(id);

-- ── 2) add_umbrella_execution: lança uma execução nova numa proposta
--      guarda-chuva já aprovada, sem tocar em nada que já existe ──

CREATE OR REPLACE FUNCTION public.add_umbrella_execution(
  p_proposal_id uuid,
  p_name text,
  p_scheduled_date date,
  p_scheduled_time time DEFAULT NULL,
  p_number_of_people int DEFAULT NULL,
  p_price_per_person numeric DEFAULT NULL,
  p_room_id uuid DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
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
  v_et_id      uuid;
  v_epo_id     uuid;
  v_bpo_id     uuid;
  v_def_count  int;
begin
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

  -- Composição-molde = a de menor sort_order (criada na aprovação original).
  select * into v_template from public.proposal_compositions
    where proposal_id = p_proposal_id order by sort_order asc limit 1;
  if not found then
    raise exception 'Proposta % não tem composição-molde para copiar itens', p_proposal_id;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order
    from public.proposal_compositions where proposal_id = p_proposal_id;

  v_people := coalesce(p_number_of_people, v_template.number_of_people, 0);

  -- 1) Nova composição (execução).
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
    coalesce(p_price_per_person, v_prop.umbrella_quota_unit_price, v_template.price_per_person),
    v_sort_order,
    p_notes,
    v_template.service_code
  ) returning id into v_comp_id;

  -- 2) Copia categorias + itens do molde pra nova composição (o "cardápio"
  --    padrão da execução recorrente — a equipe ajusta item a item depois
  --    se precisar, igual qualquer outra composição).
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

  -- 3) Evento na agenda (mesma construção de rótulo/local de
  --    create_event_from_proposal, só que sem apagar nada existente).
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
    v_people, coalesce(p_price_per_person, v_prop.umbrella_quota_unit_price, 0) * v_people,
    4, 'Agendado'
  ) returning id into v_event_id;

  perform public.create_event_notifications(v_event_id);

  -- 4) Separação (event_table + ordem de evento) própria desta execução —
  --    nunca reaproveita/edita o event_table da aprovação original.
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

  -- 5) Déficit vs. estoque só da demanda desta execução (não da proposta
  --    inteira) — mesma lógica de generate_production_from_proposal.
  create temp table _deficit_umbrella on commit drop as
  select d.bom_id, d.yield_quantity, d.yield_unit, d.deficit_qty,
         greatest(1, ceil(d.deficit_qty / nullif(d.yield_quantity, 0))::int) as batches
  from (
    select rb.id as bom_id, rb.yield_quantity, rb.yield_unit,
           (n.needed - coalesce(si.current_quantity, 0)) as deficit_qty
    from (
      select pci.material_id,
             sum(coalesce(pci.fixed_qty, pci.qty_per_person * v_people)) as needed
      from public.proposal_category_items pci
      join public.proposal_categories pc on pc.id = pci.category_id
      where pc.composition_id = v_comp_id
      group by pci.material_id
    ) n
    join public.recipes_bom rb on rb.finished_material_id = n.material_id and coalesce(rb.is_archived, false) = false
    left join public.stock_items si on si.material_id = n.material_id
  ) d
  where d.deficit_qty > 0;

  select count(*) into v_def_count from _deficit_umbrella;

  if v_def_count > 0 then
    insert into public.bom_production_orders (order_name, order_date, status, notes, created_by)
    values (
      'PROD-' || v_prop.proposal_number || '-EX' || v_sort_order,
      coalesce(p_scheduled_date, current_date), 'Planejado',
      'Produção da execução "' || coalesce(nullif(trim(p_name), ''), 'Execução') || '" (guarda-chuva ' || v_prop.proposal_number || ')',
      auth.uid()
    ) returning id into v_bpo_id;

    insert into public.bom_production_order_items
      (production_order_id, bom_id, quantity, multiplier, total_yield_quantity, yield_unit, position)
    select v_bpo_id, bom_id, batches, batches::numeric, batches * coalesce(yield_quantity, 0), coalesce(yield_unit, 'un'), row_number() over ()
    from _deficit_umbrella;
  end if;

  return v_comp_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.add_umbrella_execution(uuid, text, date, time, int, numeric, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_umbrella_execution(uuid, text, date, time, int, numeric, uuid, text, text) TO authenticated;

-- ── 3) get_umbrella_progress: saldo + extrato, read-only ────────────────

CREATE OR REPLACE FUNCTION public.get_umbrella_progress(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop   record;
  v_result jsonb;
begin
  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;

  select jsonb_build_object(
    'quota_quantity', v_prop.umbrella_quota_quantity,
    'quota_unit_price', v_prop.umbrella_quota_unit_price,
    'quota_value_total', coalesce(v_prop.umbrella_quota_quantity, 0) * coalesce(v_prop.umbrella_quota_unit_price, 0),
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
  ) agg;

  return v_result;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_umbrella_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_umbrella_progress(uuid) TO authenticated;

-- Ordem de produção da execução só na VÉSPERA (zona congelada) — 20/ago/2026.
--
-- Decisão de processo (realidade operacional CMPC): eventos mudam (data,
-- quantidade, sala, cancelamento) até perto de acontecer. A Ordem de EVENTO
-- nasce na confirmação e sinaliza o evento futuro (data/quantidades/sala);
-- a Ordem de PRODUÇÃO só nasce quando o evento entra na janela de véspera
-- (configurável, padrão 48h) — a partir daí a execução está congelada
-- (o portal já bloqueia solicitações a menos de portal.prazo_minimo_horas).
--
-- Bônus técnico: o déficit calculado na confirmação era contra estoque STALE
-- (o estoque de daqui a uma semana não é o de hoje). Na véspera, o cálculo é
-- contra o estoque real do momento. As Necessidades de Compra não dependem
-- disso — o MRP lê a demanda dos eventos futuros diretamente.
--
-- 1) app_settings 'producao.execucao_antecedencia_horas' (padrão 48).
-- 2) Helper generate_umbrella_execution_production(composition_id):
--    déficit vs estoque atual → bom_production_orders (nome determinístico
--    PROD-<número>-EX<ordem>; idempotente — não duplica ordem viva).
-- 3) add_umbrella_execution: não gera mais BPO na hora — só se o evento JÁ
--    estiver dentro da janela (ex.: relançamento de véspera).
-- 4) generate_due_umbrella_production() + pg_cron de hora em hora: gera a
--    BPO de toda execução que entrou na janela.

INSERT INTO public.app_settings (key, value)
VALUES ('producao.execucao_antecedencia_horas', '48')
ON CONFLICT (key) DO NOTHING;

-- ── 2) Helper: gera a ordem de produção de UMA execução ────────────────
CREATE OR REPLACE FUNCTION public.generate_umbrella_execution_production(p_composition_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_comp       record;
  v_prop       record;
  v_people     int;
  v_order_name text;
  v_bpo_id     uuid := null;
  v_def_count  int;
begin
  select * into v_comp from public.proposal_compositions where id = p_composition_id;
  if not found then
    raise exception 'Composição % não encontrada', p_composition_id;
  end if;
  select * into v_prop from public.proposals where id = v_comp.proposal_id;

  v_order_name := 'PROD-' || v_prop.proposal_number || '-EX' || v_comp.sort_order;
  -- Idempotente: já existe ordem viva desta execução → nada a fazer
  if exists (select 1 from public.bom_production_orders
             where order_name = v_order_name and status <> 'Cancelado') then
    return null;
  end if;

  v_people := coalesce(v_comp.number_of_people, 0);

  drop table if exists _deficit_exec;
  create temp table _deficit_exec on commit drop as
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
      where pc.composition_id = p_composition_id
      group by pci.material_id
    ) n
    join public.recipes_bom rb on rb.finished_material_id = n.material_id and coalesce(rb.is_archived, false) = false
    left join public.stock_items si on si.material_id = n.material_id
  ) d
  where d.deficit_qty > 0;

  select count(*) into v_def_count from _deficit_exec;

  if v_def_count > 0 then
    insert into public.bom_production_orders (order_name, order_date, status, notes, created_by)
    values (
      v_order_name,
      coalesce(v_comp.scheduled_date, current_date), 'Planejado',
      'Produção da execução "' || coalesce(nullif(trim(v_comp.name), ''), 'Execução') || '" (guarda-chuva ' || v_prop.proposal_number || ')',
      auth.uid()
    ) returning id into v_bpo_id;

    insert into public.bom_production_order_items
      (production_order_id, bom_id, quantity, multiplier, total_yield_quantity, yield_unit, position)
    select v_bpo_id, bom_id, batches, batches::numeric, batches * coalesce(yield_quantity, 0), coalesce(yield_unit, 'un'), row_number() over ()
    from _deficit_exec;
  end if;

  return v_bpo_id;
end;
$function$;

-- Só contextos definer (add_umbrella_execution, cron) chamam — sem grants.
REVOKE EXECUTE ON FUNCTION public.generate_umbrella_execution_production(uuid) FROM PUBLIC;

-- ── 3) add_umbrella_execution: BPO só se o evento já está na janela ────
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

-- ── 4) Cron: gera produção das execuções que entraram na janela ────────
CREATE OR REPLACE FUNCTION public.generate_due_umbrella_production()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_horizon numeric;
  v_count   int := 0;
  v_bpo     uuid;
  r         record;
begin
  select coalesce((select value from public.app_settings where key = 'producao.execucao_antecedencia_horas')::numeric, 48)
    into v_horizon;

  for r in
    select pc.id
    from public.proposal_compositions pc
    join public.proposals p on p.id = pc.proposal_id
      and coalesce(p.is_umbrella, false) and p.status = 'Aprovada'
    join public.events e on e.composition_id = pc.id and e.status = 'Agendado'
    where pc.scheduled_date is not null
      -- entrou na janela de véspera...
      and (pc.scheduled_date + coalesce(pc.scheduled_time, '00:00'::time))
          <= ((now() at time zone 'America/Sao_Paulo') + (v_horizon || ' hours')::interval)
      -- ...mas não é evento antigo esquecido (margem de 1 dia pro passado)
      and (pc.scheduled_date + coalesce(pc.scheduled_time, '00:00'::time))
          >= ((now() at time zone 'America/Sao_Paulo') - interval '1 day')
      -- molde (menor sort_order) nunca é execução
      and pc.id <> (select t.id from public.proposal_compositions t
                    where t.proposal_id = pc.proposal_id order by t.sort_order asc limit 1)
  loop
    v_bpo := public.generate_umbrella_execution_production(r.id);
    if v_bpo is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('generated', v_count);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.generate_due_umbrella_production() FROM PUBLIC;

DO $$ BEGIN
  PERFORM cron.unschedule('generate-umbrella-production-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('generate-umbrella-production-hourly', '15 * * * *',
  $$SELECT public.generate_due_umbrella_production()$$);

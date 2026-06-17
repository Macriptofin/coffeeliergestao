-- Fase 6: produção/ordem-de-evento composition-aware + checagem de estoque.
-- Cada proposta aprovada gera:
--   (1) UM event_table (contexto do evento) ligado à proposta;
--   (2) ORDEM DE EVENTO (separação/montagem) por COMPOSIÇÃO/momento
--       (event_production_orders com timing + event_production_order_items);
--   (3) ORDEM DE PRODUÇÃO (bom_production_orders) só do DÉFICIT, após explodir
--       as fichas técnicas e subtrair o estoque disponível (stock_items).
-- Idempotente (regenera ao reaprovar).

ALTER TABLE public.event_tables
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_event_tables_proposal ON public.event_tables(proposal_id);

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
    insert into public.event_production_orders (event_table_id, order_code, status, scheduled_start, notes)
    values (
      v_et_id, 'OE-' || v_prop.proposal_number || '-' || (v_evt_orders + 1), 'Planejado',
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

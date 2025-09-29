-- ============================================================================
-- INTEGRAÇÃO PROPOSTAS → PRODUÇÃO (ADITIVA - NÃO DESTRUTIVA) - V2
-- Corrigido para ser totalmente idempotente
-- ============================================================================

-- 1. ESTENDER TABELA PROPOSALS COM NOVOS CAMPOS
-- ============================================================================
alter table public.proposals
  add column if not exists proposal_kind text
    check (proposal_kind in ('event_table','bom_sku')) default 'event_table',
  add column if not exists auto_generated_event_id uuid 
    references public.events(id) on delete set null,
  add column if not exists auto_generated_event_table_id uuid 
    references public.event_tables(id) on delete set null,
  add column if not exists auto_generated_bom_order_id uuid 
    references public.bom_production_orders(id) on delete set null;

-- 2. NOVA ESTRUTURA: CATEGORIAS LIVRES
-- ============================================================================
create table if not exists public.proposal_categories (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  category_label text not null,
  sort_order int default 1,
  created_at timestamptz default now()
);

create index if not exists idx_proposal_categories_proposal 
  on public.proposal_categories(proposal_id);

-- 3. NOVA ESTRUTURA: ITENS POR CATEGORIA (3 TIPOS)
-- ============================================================================
create table if not exists public.proposal_category_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.proposal_categories(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  item_kind text not null 
    check (item_kind in ('produce_finished','pick_resale','support_material')),
  qty_per_person numeric check (qty_per_person > 0),
  fixed_qty numeric check (fixed_qty > 0),
  unit_override text,
  created_at timestamptz default now(),
  constraint one_qty check (
    (qty_per_person is not null and fixed_qty is null)
    or (qty_per_person is null and fixed_qty is not null)
  )
);

create index if not exists idx_proposal_category_items_category 
  on public.proposal_category_items(category_id);
create index if not exists idx_proposal_category_items_material 
  on public.proposal_category_items(material_id);

-- 4. PICKLISTS (REVENDA E APOIO)
-- ============================================================================
create table if not exists public.proposal_picklists (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  status text not null default 'pending' 
    check (status in ('pending','fulfilled')),
  fulfilled_at timestamptz,
  fulfilled_by uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_proposal_picklists_proposal 
  on public.proposal_picklists(proposal_id);

create table if not exists public.proposal_picklist_items (
  id uuid primary key default gen_random_uuid(),
  picklist_id uuid not null references public.proposal_picklists(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  planned_qty numeric not null check (planned_qty > 0),
  planned_unit text not null,
  item_kind text not null check (item_kind in ('pick_resale','support_material')),
  created_at timestamptz default now()
);

create index if not exists idx_proposal_picklist_items_picklist 
  on public.proposal_picklist_items(picklist_id);
create index if not exists idx_proposal_picklist_items_material 
  on public.proposal_picklist_items(material_id);

-- 5. VIEW DE CONSOLIDAÇÃO
-- ============================================================================
create or replace view public.vw_proposal_breakdown as
select
  pc.proposal_id,
  pci.id as proposal_item_id,
  pc.id as category_id,
  pc.category_label,
  pci.item_kind,
  m.id as material_id,
  m.name as material_name,
  m.code as material_code,
  m.material_type,
  coalesce(
    pci.fixed_qty,
    pci.qty_per_person * p.number_of_people
  )::numeric as planned_qty,
  coalesce(pci.unit_override, m.usage_unit) as planned_unit,
  m.price_per_purchase_unit as unit_cost,
  (coalesce(
    pci.fixed_qty,
    pci.qty_per_person * p.number_of_people
  ) * m.price_per_purchase_unit)::numeric as total_cost
from proposal_category_items pci
join proposal_categories pc on pc.id = pci.category_id
join proposals p on p.id = pc.proposal_id
join materials m on m.id = pci.material_id
where p.status not in ('Cancelada', 'Rejeitada');

-- 6. FUNÇÃO ORQUESTRADORA: GERAR PRODUÇÃO A PARTIR DE PROPOSTA
-- ============================================================================
create or replace function public.generate_production_from_proposal(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal record;
  v_event_table_id uuid;
  v_bom_order_id uuid;
  v_picklist_id uuid;
  v_item record;
  v_result jsonb;
begin
  select * into v_proposal from public.proposals where id = p_proposal_id;
  
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;
  
  -- Verificar se já foi gerado (idempotência)
  if v_proposal.proposal_kind = 'event_table' 
     and v_proposal.auto_generated_event_table_id is not null then
    return jsonb_build_object(
      'status', 'already_generated',
      'message', 'Evento/mesa já foi gerado anteriormente',
      'event_table_id', v_proposal.auto_generated_event_table_id
    );
  elsif v_proposal.proposal_kind = 'bom_sku' 
        and v_proposal.auto_generated_bom_order_id is not null then
    return jsonb_build_object(
      'status', 'already_generated',
      'message', 'Ordem de produção já foi gerada anteriormente',
      'bom_order_id', v_proposal.auto_generated_bom_order_id
    );
  end if;
  
  -- CENÁRIO 1: event_table
  if v_proposal.proposal_kind = 'event_table' then
    insert into public.event_tables (
      client_id, client_name, event_code, date_start, date_end, attendees, notes, status
    ) values (
      v_proposal.client_id,
      (select name from public.clients where id = v_proposal.client_id),
      'EVT-' || to_char(now(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text, 1, 6),
      coalesce(v_proposal.event_date, current_date),
      coalesce(v_proposal.event_date, current_date),
      v_proposal.number_of_people,
      v_proposal.notes,
      'draft'
    ) returning id into v_event_table_id;
    
    -- Copiar itens produce_finished
    for v_item in
      select * from public.vw_proposal_breakdown
      where proposal_id = p_proposal_id and item_kind = 'produce_finished'
    loop
      insert into public.event_table_items (
        event_table_id, material_id, category_label, quantity_per_person, source
      ) values (
        v_event_table_id, v_item.material_id, v_item.category_label,
        v_item.planned_qty / v_proposal.number_of_people, 'proposal'
      );
    end loop;
    
    update public.proposals
    set auto_generated_event_table_id = v_event_table_id, updated_at = now()
    where id = p_proposal_id;
    
    v_result := jsonb_build_object(
      'status', 'success',
      'proposal_kind', 'event_table',
      'event_table_id', v_event_table_id
    );
  
  -- CENÁRIO 2: bom_sku
  elsif v_proposal.proposal_kind = 'bom_sku' then
    insert into public.bom_production_orders (
      order_name, order_date, status, notes, created_by
    ) values (
      'PROP-' || v_proposal.proposal_number,
      coalesce(v_proposal.event_date, current_date),
      'planned',
      'Gerado automaticamente da proposta ' || v_proposal.proposal_number,
      auth.uid()
    ) returning id into v_bom_order_id;
    
    for v_item in
      select * from public.vw_proposal_breakdown
      where proposal_id = p_proposal_id and item_kind = 'produce_finished'
    loop
      if exists (select 1 from public.recipes_bom where finished_material_id = v_item.material_id) then
        insert into public.bom_production_order_items (production_order_id, bom_id, quantity, position)
        select v_bom_order_id, rb.id, ceil(v_item.planned_qty / rb.yield_quantity), 1
        from public.recipes_bom rb where rb.finished_material_id = v_item.material_id limit 1;
      elsif exists (select 1 from public.composites_bom where composite_material_id = v_item.material_id) then
        insert into public.bom_production_order_items (production_order_id, bom_id, quantity, position)
        select v_bom_order_id, cb.id, v_item.planned_qty, 1
        from public.composites_bom cb where cb.composite_material_id = v_item.material_id limit 1;
      end if;
    end loop;
    
    update public.proposals
    set auto_generated_bom_order_id = v_bom_order_id, updated_at = now()
    where id = p_proposal_id;
    
    v_result := jsonb_build_object(
      'status', 'success',
      'proposal_kind', 'bom_sku',
      'bom_order_id', v_bom_order_id
    );
  end if;
  
  -- Criar picklist (ambos cenários)
  if exists (
    select 1 from public.vw_proposal_breakdown
    where proposal_id = p_proposal_id and item_kind in ('pick_resale', 'support_material')
  ) then
    insert into public.proposal_picklists (proposal_id, status)
    values (p_proposal_id, 'pending') returning id into v_picklist_id;
    
    insert into public.proposal_picklist_items (
      picklist_id, material_id, planned_qty, planned_unit, item_kind
    )
    select v_picklist_id, material_id, planned_qty, planned_unit, item_kind
    from public.vw_proposal_breakdown
    where proposal_id = p_proposal_id
      and item_kind in ('pick_resale', 'support_material');
    
    v_result := v_result || jsonb_build_object('picklist_id', v_picklist_id);
  end if;
  
  return v_result;
end;
$$;

-- 7. FUNÇÃO: FINALIZAR ENTREGA
-- ============================================================================
create or replace function public.finalize_proposal_fulfillment(
  p_proposal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_picklist_id uuid;
  v_item record;
  v_consumed_count int := 0;
begin
  select id into v_picklist_id
  from public.proposal_picklists
  where proposal_id = p_proposal_id and status = 'pending';
  
  if not found then
    return jsonb_build_object(
      'status', 'error',
      'message', 'Nenhuma picklist pendente encontrada'
    );
  end if;
  
  for v_item in select * from public.proposal_picklist_items where picklist_id = v_picklist_id
  loop
    insert into public.stock_movements (
      material_id, movement_type, quantity, reference_type, reference_id, notes
    ) values (
      v_item.material_id, 'Consumo', v_item.planned_qty,
      'proposal_fulfillment', p_proposal_id,
      'Baixa automática: entrega de proposta'
    );
    
    update public.stock_items
    set current_quantity = current_quantity - v_item.planned_qty,
        last_movement_date = now(), updated_at = now()
    where material_id = v_item.material_id;
    
    v_consumed_count := v_consumed_count + 1;
  end loop;
  
  update public.proposal_picklists
  set status = 'fulfilled', fulfilled_at = now(),
      fulfilled_by = auth.uid(), updated_at = now()
  where id = v_picklist_id;
  
  update public.proposals
  set status = 'Entregue', updated_at = now()
  where id = p_proposal_id;
  
  return jsonb_build_object(
    'status', 'success',
    'picklist_id', v_picklist_id,
    'items_consumed', v_consumed_count,
    'message', format('Baixa realizada para %s itens', v_consumed_count)
  );
end;
$$;

-- 8. RLS POLICIES (idempotente)
-- ============================================================================
alter table public.proposal_categories enable row level security;
alter table public.proposal_category_items enable row level security;
alter table public.proposal_picklists enable row level security;
alter table public.proposal_picklist_items enable row level security;

drop policy if exists "Admins and managers can manage proposal_categories" on public.proposal_categories;
create policy "Admins and managers can manage proposal_categories"
  on public.proposal_categories for all to authenticated
  using (is_admin_or_manager(auth.uid()))
  with check (is_admin_or_manager(auth.uid()));

drop policy if exists "Admins and managers can manage proposal_category_items" on public.proposal_category_items;
create policy "Admins and managers can manage proposal_category_items"
  on public.proposal_category_items for all to authenticated
  using (is_admin_or_manager(auth.uid()))
  with check (is_admin_or_manager(auth.uid()));

drop policy if exists "Admins and managers can manage proposal_picklists" on public.proposal_picklists;
create policy "Admins and managers can manage proposal_picklists"
  on public.proposal_picklists for all to authenticated
  using (is_admin_or_manager(auth.uid()))
  with check (is_admin_or_manager(auth.uid()));

drop policy if exists "Admins and managers can manage proposal_picklist_items" on public.proposal_picklist_items;
create policy "Admins and managers can manage proposal_picklist_items"
  on public.proposal_picklist_items for all to authenticated
  using (is_admin_or_manager(auth.uid()))
  with check (is_admin_or_manager(auth.uid()));

-- 9. TRIGGERS
-- ============================================================================
drop trigger if exists update_proposal_picklists_updated_at on public.proposal_picklists;
create trigger update_proposal_picklists_updated_at
  before update on public.proposal_picklists
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- INTEGRAÇÃO COMPLETA - 100% ADITIVA E IDEMPOTENTE
-- ============================================================================
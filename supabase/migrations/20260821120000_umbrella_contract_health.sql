-- Saúde financeira do contrato guarda-chuva (21/ago/2026, pauta item 1).
--
-- Preço do contrato é congelado; o CUSTO segue vivo — a margem deriva ao
-- longo do ano sem ninguém enxergar. get_umbrella_progress passa a devolver
-- 'health': preço unitário contratado, custo unitário NA ASSINATURA (do
-- snapshot da última revisão em proposal_revisions: total_cost ÷ pessoas) e
-- custo unitário HOJE (itens da composição-molde valorados pela MESMA cadeia
-- de custo do editor: cached_unit_cost da ficha > average_price do estoque >
-- cost_price manual). O painel interno mostra margem na assinatura × hoje —
-- o termômetro de renegociação pedido pelo usuário.

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

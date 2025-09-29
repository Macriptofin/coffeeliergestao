-- ============================================================================
-- CORREÇÕES DE SEGURANÇA - VIEW E SEARCH_PATH
-- ============================================================================

-- 1. CORRIGIR VIEW: Remover SECURITY DEFINER (não necessário para views de leitura)
-- ============================================================================
-- A view vw_proposal_breakdown não precisa ser SECURITY DEFINER porque:
-- - Ela apenas faz joins de tabelas que já têm RLS
-- - As permissões serão aplicadas pelas policies das tabelas base
-- - Views normais são mais seguras para leitura simples

drop view if exists public.vw_proposal_breakdown;

create view public.vw_proposal_breakdown 
with (security_invoker = true)
as
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

comment on view public.vw_proposal_breakdown is 
  'Visão consolidada de itens de propostas (security_invoker para respeitar RLS)';

-- 2. GRANT PARA VIEW (permitir leitura para usuários autenticados)
-- ============================================================================
grant select on public.vw_proposal_breakdown to authenticated;

-- ============================================================================
-- NOTA: As funções já têm "set search_path = public" definido corretamente
-- nas migrations anteriores, então o warning 2 é sobre outras funções legacy
-- que não foram criadas nesta migration.
-- ============================================================================
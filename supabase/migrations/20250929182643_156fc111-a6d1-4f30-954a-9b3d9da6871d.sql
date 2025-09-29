-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: View e Search Path
-- ============================================================================

-- 1. Recriar view sem SECURITY DEFINER implícito
-- ============================================================================
drop view if exists public.vw_proposal_breakdown;

create view public.vw_proposal_breakdown 
with (security_invoker=true) -- Usa permissões do usuário que executa a query
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
  'Visão consolidada de todos os itens de propostas (nova estrutura) - SECURITY INVOKER';

-- ============================================================================
-- FIM DA CORREÇÃO
-- ============================================================================
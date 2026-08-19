-- Portal: visibilidade de pedidos recorrentes (guarda-chuva) + calendário por usuário.
--
-- 1) get_portal_proposals ganha os campos de recorrência (is_umbrella, cota,
--    consumido, próxima/última execução) pra home do portal separar "Em aberto"
--    de "Atendidos" e renderizar o card de recorrência com barra de progresso.
-- 2) get_portal_proposal ganha o bloco de saldo (cota × consumido) no detalhe.
-- 3) get_portal_my_events (nova): datas de eventos pro calendário do portal.
--    Escopo POR USUÁRIO, igual ao resto do portal: client_id do vínculo +
--    portal_created_by = auth.uid() — o usuário só vê os eventos dos pedidos
--    que ELE criou/recebeu, nunca os da empresa inteira.
-- Nenhuma função expõe custo/margem (mesma disciplina das RPCs existentes).

CREATE OR REPLACE FUNCTION public.get_portal_proposals()
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
         FROM public.proposal_compositions pc WHERE pc.proposal_id = p.id)
      ELSE NULL END,
    'next_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT min(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id AND pc.scheduled_date >= current_date)
      ELSE NULL END,
    'last_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT max(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id)
      ELSE NULL END
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.proposals p
  WHERE p.client_id = v_client AND p.portal_created_by = auth.uid();
  RETURN v_result;
END;
$function$;

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
         FROM public.proposal_compositions pc2 WHERE pc2.proposal_id = p.id)
      ELSE NULL END,
    'payment_terms', COALESCE(p.payment_terms, c.payment_terms), 'notes', p.notes,
    'client_name', c.name, 'department_id', p.department_id, 'department_name', cd.name,
    'unit_name', cu.name, 'room_name', cr.name, 'event_location_name', p.event_location_name,
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
    AND e.event_date IS NOT NULL;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_my_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_my_events() TO authenticated;

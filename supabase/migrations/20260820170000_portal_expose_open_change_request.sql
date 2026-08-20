-- Portal: expõe se a proposta tem solicitação de alteração ABERTA
-- (proposal_change_requests.status = 'aberta') nas duas RPCs de leitura
-- (20/ago/2026). Motivo: depois de pedir alteração, a home continuava
-- mostrando "Aguardando você" — mentira, a bola está com a equipe. O front
-- usa has_open_change_request pra trocar o selo por "Alteração em análise".

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

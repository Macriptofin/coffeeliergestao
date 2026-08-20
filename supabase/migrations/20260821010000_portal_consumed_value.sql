-- get_portal_proposal: expõe consumed_value (R$ consumido real, somando o
-- preço de cada execução — não aproximação por quantidade × preço de
-- referência) pro saldo do contrato no portal mostrar quantidade E valor
-- (21/ago/2026, layout macro do contrato aprovado pelo usuário).

-- ── 4) get_portal_proposal: fornecimentos (sem a molde) + kind/target ──
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
         LEFT JOIN public.events e2 ON e2.composition_id = pc2.id
         WHERE pc2.proposal_id = p.id
           AND pc2.id <> (SELECT t.id FROM public.proposal_compositions t
                          WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e2.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'consumed_value', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc2b.number_of_people * coalesce(pc2b.price_per_person, 0)), 0)
         FROM public.proposal_compositions pc2b
         LEFT JOIN public.events e2b ON e2b.composition_id = pc2b.id
         WHERE pc2b.proposal_id = p.id
           AND pc2b.id <> (SELECT t.id FROM public.proposal_compositions t
                           WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1)
           AND e2b.status IS DISTINCT FROM 'Cancelado')
      ELSE NULL END,
    'executions', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'composition_id', pc3.id, 'name', pc3.name,
          'scheduled_date', pc3.scheduled_date, 'scheduled_time', pc3.scheduled_time,
          'number_of_people', pc3.number_of_people,
          'room_id', pc3.room_id, 'room_name', r3.name, 'location', pc3.location,
          'event_status', e3.status,
          'has_open_request', EXISTS (
            SELECT 1 FROM public.umbrella_execution_requests r
            WHERE r.target_composition_id = pc3.id AND r.status = 'aberta')
        ) ORDER BY pc3.scheduled_date NULLS LAST, pc3.sort_order), '[]'::jsonb)
        FROM public.proposal_compositions pc3
        LEFT JOIN public.events e3 ON e3.composition_id = pc3.id
        LEFT JOIN public.client_rooms r3 ON r3.id = pc3.room_id
        WHERE pc3.proposal_id = p.id
          AND pc3.id <> (SELECT t.id FROM public.proposal_compositions t
                         WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      ELSE NULL END,
    'execution_requests', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', uer.id, 'name', uer.name, 'scheduled_date', uer.scheduled_date,
        'scheduled_time', uer.scheduled_time, 'number_of_people', uer.number_of_people,
        'room_name', rr.name, 'status', uer.status, 'created_at', uer.created_at,
        'kind', uer.kind, 'target_name', tc.name
      ) ORDER BY uer.scheduled_date), '[]'::jsonb)
      FROM public.umbrella_execution_requests uer
      LEFT JOIN public.client_rooms rr ON rr.id = uer.room_id
      LEFT JOIN public.proposal_compositions tc ON tc.id = uer.target_composition_id
      WHERE uer.proposal_id = p.id AND uer.status = 'aberta'
    ),
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


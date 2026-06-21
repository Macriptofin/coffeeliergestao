-- Leitura do detalhe no portal: expõe event_name (topo) e event_category por momento.
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

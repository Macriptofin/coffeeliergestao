-- get_portal_proposal_pdf não expunha payment_terms — o PDF do Portal sempre
-- mostrava a condição de pagamento fixa no componente (hardcoded), ignorando
-- a condição real da proposta/cliente. Mesma prioridade que get_portal_proposal
-- já usa (proposal.payment_terms > clients.payment_terms), resolvida no
-- front (buildProposalData), então só precisamos expor os dois valores crus aqui.
CREATE OR REPLACE FUNCTION public.get_portal_proposal_pdf(p_proposal_id uuid)
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
    'proposal', jsonb_build_object(
      'id', p.id, 'proposal_number', p.proposal_number, 'revision', p.revision,
      'event_name', p.event_name, 'event_category', p.event_category,
      'number_of_people', p.number_of_people, 'event_date', p.event_date,
      'total_amount', p.total_amount, 'target_weight_per_person', p.target_weight_per_person,
      'status', p.status, 'payment_terms', p.payment_terms,
      'clients', jsonb_build_object('name', c.name, 'cnpj_cpf', c.cnpj_cpf, 'payment_terms', c.payment_terms),
      'client_departments', CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object('name', cd.name) END,
      'client_units', CASE WHEN cu.id IS NULL THEN NULL ELSE jsonb_build_object('name', cu.name, 'address', cu.address) END,
      'client_rooms', CASE WHEN cr.id IS NULL THEN NULL ELSE jsonb_build_object('name', cr.name) END,
      'client_contacts', CASE WHEN cc.id IS NULL THEN NULL ELSE jsonb_build_object('name', cc.name, 'email', cc.email, 'phone', cc.phone) END
    ),
    'compositions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', comp.id, 'name', comp.name, 'event_category', comp.event_category,
        'scheduled_date', comp.scheduled_date, 'scheduled_time', comp.scheduled_time,
        'location', comp.location, 'sort_order', comp.sort_order,
        'price_per_person', comp.price_per_person, 'number_of_people', comp.number_of_people,
        'client_rooms', CASE WHEN compr.id IS NULL THEN NULL ELSE jsonb_build_object('name', compr.name) END
      ) ORDER BY comp.sort_order), '[]'::jsonb)
      FROM public.proposal_compositions comp
      LEFT JOIN public.client_rooms compr ON compr.id = comp.room_id
      WHERE comp.proposal_id = p.id
    ),
    'categories', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category_label', pc.category_label, 'sort_order', pc.sort_order, 'composition_id', pc.composition_id,
        'proposal_category_items', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'qty_per_person', pci.qty_per_person, 'fixed_qty', pci.fixed_qty,
            'materials', jsonb_build_object('name', m.name, 'usage_unit', m.usage_unit, 'unit_weight', m.unit_weight, 'category', m.category)
          )), '[]'::jsonb)
          FROM public.proposal_category_items pci JOIN public.materials m ON m.id = pci.material_id
          WHERE pci.category_id = pc.id
        )
      ) ORDER BY pc.sort_order), '[]'::jsonb)
      FROM public.proposal_categories pc WHERE pc.proposal_id = p.id
    )
  ) INTO v_result
  FROM public.proposals p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.client_departments cd ON cd.id = p.department_id
  LEFT JOIN public.client_units cu ON cu.id = p.unit_id
  LEFT JOIN public.client_rooms cr ON cr.id = p.room_id
  LEFT JOIN public.client_contacts cc ON cc.id = p.contact_id
  WHERE p.id = p_proposal_id AND p.client_id = v_client AND p.portal_created_by = auth.uid();

  IF v_result IS NULL THEN RETURN jsonb_build_object('error','Proposta não encontrada'); END IF;
  RETURN v_result;
END;
$function$;

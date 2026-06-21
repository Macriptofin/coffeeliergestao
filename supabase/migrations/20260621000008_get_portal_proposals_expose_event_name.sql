-- Lista do portal: expõe event_name (título do pedido) além do event_category legado.
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
    'total_amount', p.total_amount, 'status', p.status, 'created_at', p.created_at
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.proposals p
  WHERE p.client_id = v_client AND p.portal_created_by = auth.uid();
  RETURN v_result;
END;
$function$;

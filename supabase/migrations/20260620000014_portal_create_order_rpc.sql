-- Cria um pedido a partir do portal (Fase 2). Valida itens contra o catálogo do cliente,
-- calcula total estimado, status 'Enviada' (cai na esteira interna), portal_created_by = usuário.
CREATE OR REPLACE FUNCTION public.create_portal_order(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_client uuid; v_proposal_id uuid; v_people int; v_total numeric := 0;
  v_comp jsonb; v_comp_id uuid; v_sec jsonb; v_cat_id uuid; v_item jsonb;
  v_price numeric; v_mtype text; v_kind text; v_qpp numeric; v_fixed numeric;
  v_comp_people int; v_sort int; v_csort int := 0;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN jsonb_build_object('success',false,'message','Acesso não autorizado.'); END IF;
  v_people := COALESCE((p_payload->>'number_of_people')::int, 0);
  IF v_people <= 0 THEN RETURN jsonb_build_object('success',false,'message','Informe o número de pessoas.'); END IF;
  IF (p_payload->'compositions') IS NULL OR jsonb_array_length(p_payload->'compositions') = 0 THEN
    RETURN jsonb_build_object('success',false,'message','Adicione ao menos um momento com itens.');
  END IF;
  IF NULLIF(p_payload->>'unit_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.client_units WHERE id=(p_payload->>'unit_id')::uuid AND client_id=v_client) THEN
    RETURN jsonb_build_object('success',false,'message','Unidade inválida.');
  END IF;
  INSERT INTO public.proposals (client_id, status, portal_created_by, number_of_people,
    event_date, proposal_date, event_category, notes, unit_id, department_id, room_id, payment_terms)
  VALUES (v_client, 'Enviada', auth.uid(), v_people,
    NULLIF(p_payload->>'event_date','')::date, current_date,
    NULLIF(p_payload->>'event_category',''), NULLIF(p_payload->>'notes',''),
    NULLIF(p_payload->>'unit_id','')::uuid, NULLIF(p_payload->>'department_id','')::uuid,
    NULLIF(p_payload->>'room_id','')::uuid,
    (SELECT payment_terms FROM public.clients WHERE id=v_client))
  RETURNING id INTO v_proposal_id;
  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_payload->'compositions') LOOP
    v_comp_people := COALESCE((v_comp->>'number_of_people')::int, v_people);
    INSERT INTO public.proposal_compositions (proposal_id, name, scheduled_date, scheduled_time, location, number_of_people, sort_order)
    VALUES (v_proposal_id, COALESCE(NULLIF(v_comp->>'name',''),'Momento'),
      NULLIF(v_comp->>'scheduled_date','')::date, NULLIF(v_comp->>'scheduled_time','')::time,
      NULLIF(v_comp->>'location',''), v_comp_people, v_csort)
    RETURNING id INTO v_comp_id;
    v_csort := v_csort + 1; v_sort := 0;
    FOR v_sec IN SELECT * FROM jsonb_array_elements(v_comp->'sections') LOOP
      INSERT INTO public.proposal_categories (proposal_id, composition_id, category_label, sort_order)
      VALUES (v_proposal_id, v_comp_id, COALESCE(NULLIF(v_sec->>'category_label',''),'Itens'), v_sort)
      RETURNING id INTO v_cat_id;
      v_sort := v_sort + 1;
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_sec->'items') LOOP
        SELECT COALESCE(m.practiced_price, m.suggested_price, 0), m.material_type INTO v_price, v_mtype
        FROM public.client_catalog_items cci JOIN public.materials m ON m.id = cci.material_id
        WHERE cci.client_id = v_client AND cci.is_active = true AND cci.material_id = (v_item->>'material_id')::uuid;
        IF NOT FOUND THEN RAISE EXCEPTION 'Produto fora do catálogo do cliente.'; END IF;
        v_kind := CASE WHEN v_mtype = 'resale_product' THEN 'pick_resale'
          WHEN v_mtype IN ('finished_product','composite_product','intermediate_product') THEN 'produce_finished'
          ELSE 'support_material' END;
        v_qpp := NULLIF(v_item->>'qty_per_person','')::numeric;
        v_fixed := NULLIF(v_item->>'fixed_qty','')::numeric;
        IF v_qpp IS NULL AND v_fixed IS NULL THEN CONTINUE; END IF;
        IF v_qpp IS NOT NULL THEN v_fixed := NULL; END IF;
        INSERT INTO public.proposal_category_items (category_id, material_id, qty_per_person, fixed_qty, item_kind)
        VALUES (v_cat_id, (v_item->>'material_id')::uuid, v_qpp, v_fixed, v_kind);
        v_total := v_total + CASE WHEN v_qpp IS NOT NULL THEN v_price*v_qpp*v_comp_people ELSE COALESCE(v_fixed,0)*v_price END;
      END LOOP;
    END LOOP;
  END LOOP;
  UPDATE public.proposals SET total_amount = v_total WHERE id = v_proposal_id;
  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id,
    'message', 'Pedido enviado! Nossa equipe vai revisar e confirmar.');
END;
$$;

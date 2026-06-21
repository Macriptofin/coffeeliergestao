-- Alinha o pedido do portal ao novo modelo: grava proposals.event_name (nome do evento)
-- e proposal_compositions.event_category (tipo POR momento). event_category da proposta
-- segue legado (tipo do 1º momento, enviado pelo front) p/ PDF/lista.
CREATE OR REPLACE FUNCTION public.create_portal_order(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid; v_proposal_id uuid; v_people int; v_total numeric := 0;
  v_status text; v_existing uuid; v_loc text;
  v_comp jsonb; v_comp_id uuid; v_sec jsonb; v_cat_id uuid; v_item jsonb;
  v_price numeric; v_mtype text; v_kind text; v_qpp numeric; v_fixed numeric;
  v_comp_people int; v_sort int; v_csort int := 0; v_has_comps boolean;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN jsonb_build_object('success',false,'message','Acesso não autorizado.'); END IF;

  v_status := COALESCE(NULLIF(p_payload->>'status',''), 'Enviada');
  IF v_status NOT IN ('Rascunho','Enviada') THEN v_status := 'Enviada'; END IF;
  v_people := COALESCE((p_payload->>'number_of_people')::int, 0);
  v_existing := NULLIF(p_payload->>'proposal_id','')::uuid;
  v_has_comps := (p_payload->'compositions') IS NOT NULL AND jsonb_array_length(p_payload->'compositions') > 0;

  -- Validações fortes só ao ENVIAR (rascunho pode estar incompleto).
  IF v_status = 'Enviada' THEN
    IF v_people <= 0 THEN RETURN jsonb_build_object('success',false,'message','Informe o número de pessoas.'); END IF;
    IF NOT v_has_comps THEN RETURN jsonb_build_object('success',false,'message','Adicione ao menos um momento com itens.'); END IF;
  END IF;

  IF v_existing IS NOT NULL THEN
    PERFORM 1 FROM public.proposals
     WHERE id = v_existing AND client_id = v_client AND portal_created_by = auth.uid() AND status = 'Rascunho';
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Rascunho não encontrado ou não editável.'); END IF;
    v_proposal_id := v_existing;
    DELETE FROM public.proposal_categories  WHERE proposal_id = v_proposal_id; -- cascade itens
    DELETE FROM public.proposal_compositions WHERE proposal_id = v_proposal_id;
    UPDATE public.proposals SET
      status = v_status, number_of_people = v_people,
      event_date = NULLIF(p_payload->>'event_date','')::date,
      event_name = NULLIF(p_payload->>'event_name',''),
      event_category = NULLIF(p_payload->>'event_category',''), notes = NULLIF(p_payload->>'notes',''),
      unit_id = NULLIF(p_payload->>'unit_id','')::uuid, department_id = NULLIF(p_payload->>'department_id','')::uuid,
      room_id = NULLIF(p_payload->>'room_id','')::uuid, updated_at = now()
    WHERE id = v_proposal_id;
  ELSE
    INSERT INTO public.proposals (client_id, status, portal_created_by, number_of_people,
      event_date, proposal_date, event_name, event_category, notes, unit_id, department_id, room_id, payment_terms)
    VALUES (v_client, v_status, auth.uid(), v_people,
      NULLIF(p_payload->>'event_date','')::date, current_date,
      NULLIF(p_payload->>'event_name',''),
      NULLIF(p_payload->>'event_category',''), NULLIF(p_payload->>'notes',''),
      NULLIF(p_payload->>'unit_id','')::uuid, NULLIF(p_payload->>'department_id','')::uuid,
      NULLIF(p_payload->>'room_id','')::uuid,
      (SELECT payment_terms FROM public.clients WHERE id = v_client))
    RETURNING id INTO v_proposal_id;
  END IF;

  IF v_has_comps THEN
    FOR v_comp IN SELECT * FROM jsonb_array_elements(p_payload->'compositions') LOOP
      v_comp_people := COALESCE((v_comp->>'number_of_people')::int, v_people);
      v_loc := NULLIF(btrim(concat_ws(' · ',
        (SELECT name FROM public.client_units WHERE id = NULLIF(v_comp->>'unit_id','')::uuid),
        (SELECT name FROM public.client_rooms WHERE id = NULLIF(v_comp->>'room_id','')::uuid))), '');
      INSERT INTO public.proposal_compositions (proposal_id, name, event_category, scheduled_date, scheduled_time, location, number_of_people, sort_order, unit_id, room_id)
      VALUES (v_proposal_id, COALESCE(NULLIF(v_comp->>'name',''),'Momento'),
        NULLIF(v_comp->>'event_category',''),
        NULLIF(v_comp->>'scheduled_date','')::date, NULLIF(v_comp->>'scheduled_time','')::time,
        COALESCE(v_loc, NULLIF(v_comp->>'location','')), v_comp_people, v_csort,
        NULLIF(v_comp->>'unit_id','')::uuid, NULLIF(v_comp->>'room_id','')::uuid)
      RETURNING id INTO v_comp_id;
      v_csort := v_csort + 1; v_sort := 0;

      FOR v_sec IN SELECT * FROM jsonb_array_elements(COALESCE(v_comp->'sections','[]'::jsonb)) LOOP
        INSERT INTO public.proposal_categories (proposal_id, composition_id, category_label, sort_order)
        VALUES (v_proposal_id, v_comp_id, COALESCE(NULLIF(v_sec->>'category_label',''),'Itens'), v_sort)
        RETURNING id INTO v_cat_id;
        v_sort := v_sort + 1;

        FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sec->'items','[]'::jsonb)) LOOP
          SELECT COALESCE(m.practiced_price, m.suggested_price, 0), m.material_type INTO v_price, v_mtype
          FROM public.client_catalog_items cci JOIN public.materials m ON m.id = cci.material_id
          WHERE cci.client_id = v_client AND cci.is_active = true AND cci.material_id = (v_item->>'material_id')::uuid;
          IF NOT FOUND THEN RAISE EXCEPTION 'Produto fora do catálogo do cliente.'; END IF;
          v_kind := CASE WHEN v_mtype='resale_product' THEN 'pick_resale'
            WHEN v_mtype IN ('finished_product','composite_product','intermediate_product') THEN 'produce_finished'
            ELSE 'support_material' END;
          -- QUANTIDADES SEMPRE INTEIRAS (evita quebra na produção)
          v_qpp := round(NULLIF(v_item->>'qty_per_person','')::numeric);
          v_fixed := round(NULLIF(v_item->>'fixed_qty','')::numeric);
          IF COALESCE(v_qpp,0) <= 0 AND COALESCE(v_fixed,0) <= 0 THEN CONTINUE; END IF;
          IF v_qpp IS NOT NULL AND v_qpp > 0 THEN v_fixed := NULL; ELSE v_qpp := NULL; END IF;
          INSERT INTO public.proposal_category_items (category_id, material_id, qty_per_person, fixed_qty, item_kind)
          VALUES (v_cat_id, (v_item->>'material_id')::uuid, v_qpp, v_fixed, v_kind);
          v_total := v_total + CASE WHEN v_qpp IS NOT NULL THEN v_price*v_qpp*v_comp_people ELSE COALESCE(v_fixed,0)*v_price END;
        END LOOP;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.proposals SET total_amount = v_total WHERE id = v_proposal_id;

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id, 'status', v_status,
    'message', CASE WHEN v_status='Rascunho' THEN 'Rascunho salvo! Você pode continuar depois.'
                    ELSE 'Pedido enviado! Nossa equipe vai revisar e confirmar.' END);
END;
$function$;

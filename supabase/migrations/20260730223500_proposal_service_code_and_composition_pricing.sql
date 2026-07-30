-- Código de Serviço (NF/pedido de compra do cliente) é dado da PRÓPRIA Coffeelier
-- (enquadramento fiscal), não do cliente nem editável toda hora — vira config de
-- empresa (padrão pra toda proposta), com override raro por momento (ex.: kit
-- vendido como produto em vez de serviço).
INSERT INTO public.config_options (namespace_id, key, value_type, default_value, description)
SELECT id, 'fiscal_service_code', 'string', '"171101"'::jsonb,
  'Código de Serviço padrão usado na tabela de valores da proposta (NF/pedido de compra do cliente) — mesmo código pra toda proposta, salvo override manual por momento'
FROM public.config_namespaces WHERE key = 'vendas'
ON CONFLICT DO NOTHING;

ALTER TABLE public.proposal_compositions ADD COLUMN IF NOT EXISTS service_code text;
COMMENT ON COLUMN public.proposal_compositions.service_code IS
  'Override raro do Código de Serviço padrão da empresa (config vendas.fiscal_service_code) — em branco na grande maioria dos casos';

-- create_portal_order nunca gravava proposal_compositions.price_per_person (só o
-- total_amount agregado da proposta) — a tabela de valores por momento (Nº Pessoas
-- × R$/pessoa) ficava sempre zerada pra pedido criado pelo cliente no Portal.
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
  v_comp_people int; v_comp_total numeric; v_sort int; v_csort int := 0; v_has_comps boolean;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN jsonb_build_object('success',false,'message','Acesso não autorizado.'); END IF;

  v_status := COALESCE(NULLIF(p_payload->>'status',''), 'Enviada');
  IF v_status NOT IN ('Rascunho','Enviada') THEN v_status := 'Enviada'; END IF;
  v_people := COALESCE((p_payload->>'number_of_people')::int, 0);
  v_existing := NULLIF(p_payload->>'proposal_id','')::uuid;
  v_has_comps := (p_payload->'compositions') IS NOT NULL AND jsonb_array_length(p_payload->'compositions') > 0;

  IF v_status = 'Enviada' THEN
    IF v_people <= 0 THEN RETURN jsonb_build_object('success',false,'message','Informe o número de pessoas.'); END IF;
    IF NOT v_has_comps THEN RETURN jsonb_build_object('success',false,'message','Adicione ao menos um momento com itens.'); END IF;
  END IF;

  IF v_existing IS NOT NULL THEN
    PERFORM 1 FROM public.proposals
     WHERE id = v_existing AND client_id = v_client AND portal_created_by = auth.uid()
       AND created_by_client = true AND status IN ('Rascunho','Enviada');
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'message','Pedido não encontrado ou não editável (já aprovado).'); END IF;
    v_proposal_id := v_existing;
    DELETE FROM public.proposal_categories  WHERE proposal_id = v_proposal_id;
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
    INSERT INTO public.proposals (client_id, status, portal_created_by, created_by_client, number_of_people,
      event_date, proposal_date, event_name, event_category, notes, unit_id, department_id, room_id, payment_terms)
    VALUES (v_client, v_status, auth.uid(), true, v_people,
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
      v_comp_total := 0;
      v_loc := NULLIF(btrim(concat_ws(' · ',
        (SELECT name FROM public.client_units WHERE id = NULLIF(v_comp->>'unit_id','')::uuid),
        (SELECT name FROM public.client_rooms WHERE id = NULLIF(v_comp->>'room_id','')::uuid))), '');
      INSERT INTO public.proposal_compositions (proposal_id, name, event_category, scheduled_date, scheduled_time, location, number_of_people, sort_order, unit_id, room_id, service_code)
      VALUES (v_proposal_id, COALESCE(NULLIF(v_comp->>'name',''),'Momento'),
        NULLIF(v_comp->>'event_category',''),
        NULLIF(v_comp->>'scheduled_date','')::date, NULLIF(v_comp->>'scheduled_time','')::time,
        COALESCE(v_loc, NULLIF(v_comp->>'location','')), v_comp_people, v_csort,
        NULLIF(v_comp->>'unit_id','')::uuid, NULLIF(v_comp->>'room_id','')::uuid,
        NULLIF(v_comp->>'service_code',''))
      RETURNING id INTO v_comp_id;
      v_csort := v_csort + 1; v_sort := 0;

      FOR v_sec IN SELECT * FROM jsonb_array_elements(COALESCE(v_comp->'sections','[]'::jsonb)) LOOP
        INSERT INTO public.proposal_categories (proposal_id, composition_id, category_label, sort_order)
        VALUES (v_proposal_id, v_comp_id, COALESCE(NULLIF(v_sec->>'category_label',''),'Itens'), v_sort)
        RETURNING id INTO v_cat_id;
        v_sort := v_sort + 1;

        FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sec->'items','[]'::jsonb)) LOOP
          SELECT COALESCE(m.practiced_price, m.suggested_price, 0), m.material_type INTO v_price, v_mtype
          FROM public.materials m
          WHERE m.id = (v_item->>'material_id')::uuid
            AND m.is_archived = false AND m.is_sellable = true AND m.is_portal_visible = true;
          IF NOT FOUND THEN RAISE EXCEPTION 'Produto fora do catálogo do portal.'; END IF;
          v_kind := CASE WHEN v_mtype='resale_product' THEN 'pick_resale'
            WHEN v_mtype IN ('finished_product','composite_product','intermediate_product') THEN 'produce_finished'
            ELSE 'support_material' END;
          v_qpp := round(NULLIF(v_item->>'qty_per_person','')::numeric);
          v_fixed := round(NULLIF(v_item->>'fixed_qty','')::numeric);
          IF COALESCE(v_qpp,0) <= 0 AND COALESCE(v_fixed,0) <= 0 THEN CONTINUE; END IF;
          IF v_qpp IS NOT NULL AND v_qpp > 0 THEN v_fixed := NULL; ELSE v_qpp := NULL; END IF;
          INSERT INTO public.proposal_category_items (category_id, material_id, qty_per_person, fixed_qty, item_kind)
          VALUES (v_cat_id, (v_item->>'material_id')::uuid, v_qpp, v_fixed, v_kind);
          v_comp_total := v_comp_total + CASE WHEN v_qpp IS NOT NULL THEN v_price*v_qpp*v_comp_people ELSE COALESCE(v_fixed,0)*v_price END;
        END LOOP;
      END LOOP;

      UPDATE public.proposal_compositions
        SET price_per_person = CASE WHEN v_comp_people > 0 THEN v_comp_total / v_comp_people ELSE 0 END
        WHERE id = v_comp_id;
      v_total := v_total + v_comp_total;
    END LOOP;
  END IF;

  UPDATE public.proposals SET total_amount = v_total WHERE id = v_proposal_id;

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id, 'status', v_status,
    'message', CASE WHEN v_status='Rascunho' THEN 'Rascunho salvo! Você pode continuar depois.'
                    ELSE 'Pedido enviado! Nossa equipe vai revisar e confirmar.' END);
END;
$function$;

-- Expõe service_code no PDF do Portal (mesmo shape do gerador interno).
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
        'service_code', comp.service_code,
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

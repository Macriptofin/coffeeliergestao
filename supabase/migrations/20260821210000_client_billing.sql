-- Faturamento consolidado por CLIENTE (21/ago/2026) — caso real CMPC: um
-- pedido de compras único cobrindo N fornecimentos avulsos de propostas
-- diferentes (e/ou execuções de contrato). Amostra aprovada pelo usuário.
--
-- O lote ganha duas naturezas: "de contrato" (proposal_id preenchido, como
-- sempre) e "de cliente" (proposal_id NULL — os itens apontam pra composições
-- de propostas distintas do mesmo cliente). O client_id já existia no header
-- desde a criação do funil, e as RLS do portal já escopam por client_id —
-- nenhuma policy muda.
--
-- 1) proposal_id vira nullable.
-- 2) Backfill de events.composition_id em eventos antigos de avulsas (o
--    create_event_from_proposal atual já carimba; os anteriores à reforma
--    ficaram sem) — só casamentos inequívocos (1 composição ↔ 1 evento).
-- 3) get_client_billable_supplies: lista os fornecimentos faturáveis do
--    cliente (avulsas + execuções de contrato), com as mesmas regras de
--    elegibilidade do funil (evento não cancelado, fora de lote vivo, molde
--    de guarda-chuva excluída). Fornecimento sem vínculo de evento fica fora.
-- 4) create_client_billing: cria o lote de cliente com as mesmas guardas.
-- 5) update_billing_status/'faturar': descrição da AR pra lote sem proposta
--    ("Faturamento consolidado — <cliente>"; antes concatenava NULL).
-- 6) get_portal_proposal/payments: cada pedido envolvido num lote consolidado
--    passa a enxergar a cobrança dele (AR de proposal_id nulo entrava em
--    nenhum pedido).

-- ── 1) Lote de cliente ─────────────────────────────────────────────────
ALTER TABLE public.proposal_billing_batches ALTER COLUMN proposal_id DROP NOT NULL;

-- ── 2) Backfill composition_id (só casamentos 1↔1 por proposta+data) ──
WITH cand AS (
  SELECT e.id AS event_id, pc.id AS comp_id,
         count(*) OVER (PARTITION BY e.id) AS n_comp_for_event,
         count(*) OVER (PARTITION BY pc.id) AS n_event_for_comp
  FROM public.events e
  JOIN public.proposal_compositions pc
    ON pc.proposal_id = e.proposal_id
   AND pc.scheduled_date IS NOT DISTINCT FROM e.event_date
  WHERE e.composition_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.events e2 WHERE e2.composition_id = pc.id)
)
UPDATE public.events e
SET composition_id = c.comp_id
FROM cand c
WHERE e.id = c.event_id AND c.n_comp_for_event = 1 AND c.n_event_for_comp = 1;

-- ── 3) Fornecimentos faturáveis do cliente ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_client_billable_supplies(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe interna';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'composition_id', pc.id,
      'proposal_id', p.id,
      'proposal_number', p.proposal_number,
      'proposal_event_name', p.event_name,
      'origin', CASE WHEN p.is_umbrella THEN 'contrato' ELSE 'avulsa' END,
      'name', pc.name,
      'scheduled_date', pc.scheduled_date,
      'scheduled_time', pc.scheduled_time,
      'number_of_people', pc.number_of_people,
      'price_per_person', pc.price_per_person,
      'value', coalesce(pc.number_of_people, 0) * coalesce(pc.price_per_person, 0),
      'event_status', e.status
    ) ORDER BY p.is_umbrella, p.proposal_number, pc.scheduled_date NULLS LAST, pc.sort_order)
    FROM public.proposal_compositions pc
    JOIN public.proposals p ON p.id = pc.proposal_id
    JOIN public.events e ON e.composition_id = pc.id
    WHERE p.client_id = p_client_id
      AND p.status = 'Aprovada'
      AND e.status <> 'Cancelado'
      -- molde de guarda-chuva nunca fatura (é o cardápio-template)
      AND NOT (p.is_umbrella AND pc.id = (
        SELECT t.id FROM public.proposal_compositions t
        WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
      -- fora de qualquer lote vivo (trava de dupla cobrança)
      AND NOT EXISTS (
        SELECT 1 FROM public.proposal_billing_items bi
        JOIN public.proposal_billing_batches b ON b.id = bi.batch_id AND b.status <> 'cancelada'
        WHERE bi.composition_id = pc.id)
  ), '[]'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_client_billable_supplies(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_billable_supplies(uuid) TO authenticated;

-- ── 4) Criar lote de cliente ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_client_billing(
  p_client_id uuid,
  p_composition_ids uuid[],
  p_purchase_order_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batch_id uuid;
  v_qty numeric;
  v_val numeric;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode criar faturamentos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Cliente % não encontrado', p_client_id;
  END IF;
  IF p_composition_ids IS NULL OR array_length(p_composition_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um fornecimento';
  END IF;

  -- Guardas por fornecimento: proposta Aprovada do cliente, não é molde de
  -- guarda-chuva, tem evento vinculado não cancelado
  IF EXISTS (
    SELECT 1 FROM unnest(p_composition_ids) cid
    LEFT JOIN public.proposal_compositions pc ON pc.id = cid
    LEFT JOIN public.proposals p ON p.id = pc.proposal_id
      AND p.client_id = p_client_id AND p.status = 'Aprovada'
    WHERE p.id IS NULL
       OR (p.is_umbrella AND pc.id = (
            SELECT t.id FROM public.proposal_compositions t
            WHERE t.proposal_id = p.id ORDER BY t.sort_order ASC LIMIT 1))
  ) THEN
    RAISE EXCEPTION 'Fornecimento inválido na seleção (não pertence a proposta aprovada deste cliente, ou é a composição-molde de um contrato)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_composition_ids) cid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.composition_id = cid AND e.status <> 'Cancelado')
  ) THEN
    RAISE EXCEPTION 'Fornecimento sem evento ativo não pode ser faturado';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_composition_ids) cid
    JOIN public.proposal_billing_items bi ON bi.composition_id = cid
    JOIN public.proposal_billing_batches b ON b.id = bi.batch_id AND b.status <> 'cancelada'
  ) THEN
    RAISE EXCEPTION 'Um dos fornecimentos já está em outro faturamento';
  END IF;

  SELECT coalesce(sum(pc.number_of_people), 0),
         coalesce(sum(pc.number_of_people * coalesce(pc.price_per_person, 0)), 0)
    INTO v_qty, v_val
  FROM public.proposal_compositions pc
  WHERE pc.id = ANY(p_composition_ids);

  INSERT INTO public.proposal_billing_batches
    (proposal_id, client_id, purchase_order_number, total_quantity, total_value, notes, created_by)
  VALUES
    (NULL, p_client_id,
     nullif(btrim(coalesce(p_purchase_order_number, '')), ''),
     v_qty, v_val, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_batch_id;

  INSERT INTO public.proposal_billing_items (batch_id, composition_id, quantity, unit_price, value)
  SELECT v_batch_id, pc.id, coalesce(pc.number_of_people, 0), coalesce(pc.price_per_person, 0),
         coalesce(pc.number_of_people, 0) * coalesce(pc.price_per_person, 0)
  FROM public.proposal_compositions pc
  WHERE pc.id = ANY(p_composition_ids);

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id,
    'total_quantity', v_qty, 'total_value', v_val);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_client_billing(uuid, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_billing(uuid, uuid[], text, text) TO authenticated;

-- ── 5) 'faturar' com descrição correta pra lote de cliente ─────────────
-- (mesma definição da migration 20260821180000 + o CASE da descrição da AR)
CREATE OR REPLACE FUNCTION public.update_billing_status(
  p_batch_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batch record;
  v_prop record;
  v_ar_id uuid;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode movimentar faturamentos';
  END IF;

  SELECT * INTO v_batch FROM public.proposal_billing_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faturamento % não encontrado', p_batch_id;
  END IF;
  SELECT * INTO v_prop FROM public.proposals WHERE id = v_batch.proposal_id;

  CASE p_action
    WHEN 'solicitar' THEN
      -- preparada → aguardando_aprovacao (solicitação registrada no Zeev)
      IF v_batch.status <> 'preparada' THEN
        RAISE EXCEPTION 'Só é possível solicitar aprovação de um faturamento preparado (status: %). Reprovado? Use "Retrabalhar" primeiro.', v_batch.status;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'aguardando_aprovacao',
          client_process_number = coalesce(nullif(btrim(coalesce(p_payload->>'client_process_number', '')), ''), client_process_number),
          approval_requested_at = now(), updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'aprovar' THEN
      IF v_batch.status <> 'aguardando_aprovacao' THEN
        RAISE EXCEPTION 'Só é possível aprovar um faturamento aguardando aprovação (status: %)', v_batch.status;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'aprovada_faturamento', approved_at = now(), updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'faturar' THEN
      -- aprovada_faturamento → faturada: NF emitida → nasce a conta a receber
      IF v_batch.status <> 'aprovada_faturamento' THEN
        RAISE EXCEPTION 'Só é possível registrar NF de um faturamento aprovado (status: %)', v_batch.status;
      END IF;
      IF nullif(btrim(coalesce(p_payload->>'invoice_number', '')), '') IS NULL THEN
        RAISE EXCEPTION 'Informe o número da nota fiscal';
      END IF;

      INSERT INTO public.accounts_receivable
        (client_id, proposal_id, invoice_number, description,
         issue_date, due_date, original_amount, remaining_amount, status,
         source_type, source_id)
      VALUES (
        v_batch.client_id, v_batch.proposal_id,
        btrim(p_payload->>'invoice_number'),
        CASE WHEN v_batch.proposal_id IS NOT NULL THEN
          'Faturamento ' || coalesce(v_prop.event_name, 'contrato') || ' — Prop. ' || v_prop.proposal_number
            || ' (' || v_batch.total_quantity || ' un)'
        ELSE
          -- Lote de CLIENTE (consolidado, sem proposta única)
          'Faturamento consolidado — ' || coalesce((SELECT name FROM public.clients WHERE id = v_batch.client_id), 'cliente')
            || ' (' || v_batch.total_quantity || ' un)'
        END,
        coalesce((p_payload->>'issued_at')::date, current_date),
        coalesce((p_payload->>'due_date')::date, current_date + 30),
        v_batch.total_value, v_batch.total_value, 'Pendente',
        'billing_batch', p_batch_id
      ) RETURNING id INTO v_ar_id;

      UPDATE public.proposal_billing_batches
      SET status = 'faturada',
          invoice_number = btrim(p_payload->>'invoice_number'),
          invoice_issued_at = coalesce((p_payload->>'issued_at')::date, current_date),
          accounts_receivable_id = v_ar_id, updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'lancar' THEN
      -- faturada → lancada: NF anexada/enviada p/ lançamento no cliente;
      -- data do lançamento confirma o vencimento (KQ15) na conta a receber
      IF v_batch.status <> 'faturada' THEN
        RAISE EXCEPTION 'Só é possível lançar um faturamento com NF emitida (status: %)', v_batch.status;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'lancada',
          posted_at = coalesce((p_payload->>'posted_at')::date, current_date),
          updated_at = now()
      WHERE id = p_batch_id;
      IF p_payload->>'due_date' IS NOT NULL AND v_batch.accounts_receivable_id IS NOT NULL THEN
        UPDATE public.accounts_receivable
        SET due_date = (p_payload->>'due_date')::date, updated_at = now()
        WHERE id = v_batch.accounts_receivable_id;
      END IF;

    WHEN 'reprovar' THEN
      -- Caminho T09 do Zeev: NF/solicitação reprovada — corrigir e retrabalhar
      IF v_batch.status NOT IN ('aguardando_aprovacao', 'aprovada_faturamento', 'faturada') THEN
        RAISE EXCEPTION 'Status % não permite reprovação', v_batch.status;
      END IF;
      -- A AR nasceu da NF; reprovada, a NF morre (cancelada na prefeitura,
      -- reemitida com outro número no retrabalho) — a cobrança cai junto,
      -- senão o refaturamento criaria uma 2ª AR do mesmo fornecimento.
      IF v_batch.accounts_receivable_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.accounts_receivable
          WHERE id = v_batch.accounts_receivable_id
            AND coalesce(received_amount, 0) > 0
        ) THEN
          RAISE EXCEPTION 'A conta a receber desta NF já tem recebimento — estorne o recebimento antes de reprovar';
        END IF;
        UPDATE public.accounts_receivable
        SET status = 'Cancelado', updated_at = now()
        WHERE id = v_batch.accounts_receivable_id;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'reprovada',
          rejected_reason = nullif(btrim(coalesce(p_payload->>'reason', '')), ''),
          updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'retrabalhar' THEN
      -- Reprovação corrigida: MESMO lote (mesmos fornecimentos), ciclo
      -- documental novo — pedido de compras novo do cliente, nova solicitação
      -- Zeev, NF nova. O ciclo morto fica registrado nas observações.
      IF v_batch.status <> 'reprovada' THEN
        RAISE EXCEPTION 'Só é possível retrabalhar um faturamento reprovado (status: %)', v_batch.status;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'preparada',
          notes = concat_ws(E'\n',
            nullif(btrim(coalesce(notes, '')), ''),
            'Ciclo reprovado em ' || to_char(coalesce(updated_at, now()), 'DD/MM/YYYY')
              || coalesce(' — pedido ' || nullif(purchase_order_number, ''), '')
              || coalesce(', Zeev ' || nullif(client_process_number, ''), '')
              || coalesce(', NF ' || nullif(invoice_number, ''), '')
              || coalesce(' — motivo: ' || nullif(rejected_reason, ''), '')),
          purchase_order_number = coalesce(nullif(btrim(coalesce(p_payload->>'purchase_order_number', '')), ''), purchase_order_number),
          client_process_number = NULL,
          approval_requested_at = NULL,
          approved_at = NULL,
          invoice_number = NULL,
          invoice_issued_at = NULL,
          posted_at = NULL,
          accounts_receivable_id = NULL,
          rejected_reason = NULL,
          updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'cancelar' THEN
      -- Libera os fornecimentos; permitido até antes da NF existir (ou após
      -- reprovação, quando a NF já morreu). Cinto: cancela AR órfã de lotes
      -- reprovados antes desta migration.
      IF v_batch.status NOT IN ('preparada', 'aguardando_aprovacao', 'aprovada_faturamento', 'reprovada') THEN
        RAISE EXCEPTION 'Faturamento com NF emitida não pode ser cancelado por aqui — estorno é fluxo contábil';
      END IF;
      IF v_batch.accounts_receivable_id IS NOT NULL THEN
        UPDATE public.accounts_receivable
        SET status = 'Cancelado', updated_at = now()
        WHERE id = v_batch.accounts_receivable_id
          AND coalesce(received_amount, 0) = 0
          AND status <> 'Cancelado';
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'cancelada', updated_at = now()
      WHERE id = p_batch_id;

    ELSE
      RAISE EXCEPTION 'Ação % desconhecida', p_action;
  END CASE;

  RETURN jsonb_build_object('success', true, 'status',
    (SELECT status FROM public.proposal_billing_batches WHERE id = p_batch_id));
END;
$function$;

-- ── 6) Portal: pedido envolvido num consolidado enxerga a cobrança ─────
-- (mesma definição vigente; muda só o WHERE do subquery 'payments')
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
    'umbrella_closed_at', p.umbrella_closed_at,
    'umbrella_close_reason', p.umbrella_close_reason,
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
         OR ar.id IN (
           -- ARs de lotes CONSOLIDADOS (proposal_id nulo) que incluem
           -- fornecimentos deste pedido
           SELECT b.accounts_receivable_id
           FROM public.proposal_billing_batches b
           JOIN public.proposal_billing_items bi ON bi.batch_id = b.id
           JOIN public.proposal_compositions pcx ON pcx.id = bi.composition_id
           WHERE pcx.proposal_id = p.id AND b.accounts_receivable_id IS NOT NULL)
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

-- Faturamento sazonal v1 (21/ago/2026, pauta item 2 — desenho aprovado).
--
-- Funil espelhando o fluxo real SAP/Zeev da CMPC:
--   preparada → aguardando_aprovacao → aprovada_faturamento → faturada →
--   lancada (+ reprovada com resolicitação; cancelada até aprovada_faturamento).
-- O sistema NÃO emite NF — organiza: pré-fatura (espelho), solicitação no
-- Zeev (nº único guardado em client_process_number — chave do futuro agente
-- de e-mail), emissão na prefeitura, lançamento no cliente (KQ15 dispara o
-- vencimento). Na fase 'faturada' nasce a conta a receber vinculada ao
-- contrato E ao lote (source_type='billing_batch'); em 'lancada' o
-- vencimento é confirmado. Estrutura genérica por PROPOSTA (serve contrato
-- recorrente hoje e pedidos avulsos amanhã).
--
-- Trava de dupla cobrança: fornecimento (composition) só pode estar em UM
-- lote vivo (status <> 'cancelada').

ALTER TABLE public.proposals ADD COLUMN client_po_number text NULL;

CREATE TABLE public.proposal_billing_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  status text NOT NULL DEFAULT 'preparada' CHECK (status IN
    ('preparada', 'aguardando_aprovacao', 'aprovada_faturamento', 'faturada', 'lancada', 'reprovada', 'cancelada')),
  purchase_order_number text NULL,
  client_process_number text NULL,
  total_quantity numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  approval_requested_at timestamptz NULL,
  approved_at timestamptz NULL,
  invoice_number text NULL,
  invoice_issued_at date NULL,
  posted_at date NULL,
  accounts_receivable_id uuid NULL REFERENCES public.accounts_receivable(id),
  rejected_reason text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.proposal_billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.proposal_billing_batches(id),
  composition_id uuid NOT NULL REFERENCES public.proposal_compositions(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  value numeric NOT NULL,
  UNIQUE (batch_id, composition_id)
);

ALTER TABLE public.proposal_billing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pbb_internal ON public.proposal_billing_batches
  FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY pbb_portal_read ON public.proposal_billing_batches
  FOR SELECT USING (client_id = public.current_portal_client_id());
CREATE POLICY pbi_internal ON public.proposal_billing_items
  FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY pbi_portal_read ON public.proposal_billing_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.proposal_billing_batches b
    WHERE b.id = batch_id AND b.client_id = public.current_portal_client_id()));

-- ── Criar lote (pré-fatura) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_proposal_billing(
  p_proposal_id uuid,
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
  v_prop record;
  v_molde uuid;
  v_batch_id uuid;
  v_qty numeric;
  v_val numeric;
BEGIN
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Apenas a equipe interna pode criar faturamentos';
  END IF;
  IF p_composition_ids IS NULL OR array_length(p_composition_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um fornecimento';
  END IF;

  SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta % não encontrada', p_proposal_id;
  END IF;

  SELECT t.id INTO v_molde FROM public.proposal_compositions t
  WHERE t.proposal_id = p_proposal_id ORDER BY t.sort_order ASC LIMIT 1;

  -- Guardas por fornecimento: pertence à proposta, não é a molde,
  -- evento não cancelado, e não está em outro lote vivo
  IF EXISTS (
    SELECT 1 FROM unnest(p_composition_ids) cid
    LEFT JOIN public.proposal_compositions pc ON pc.id = cid AND pc.proposal_id = p_proposal_id
    WHERE pc.id IS NULL OR pc.id = v_molde
  ) THEN
    RAISE EXCEPTION 'Fornecimento inválido na seleção (não pertence à proposta ou é a composição-molde)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_composition_ids) cid
    JOIN public.events e ON e.composition_id = cid
    WHERE e.status = 'Cancelado'
  ) THEN
    RAISE EXCEPTION 'Fornecimento cancelado não pode ser faturado';
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
    (p_proposal_id, v_prop.client_id,
     coalesce(nullif(btrim(coalesce(p_purchase_order_number, '')), ''), v_prop.client_po_number),
     v_qty, v_val, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_batch_id;

  INSERT INTO public.proposal_billing_items (batch_id, composition_id, quantity, unit_price, value)
  SELECT v_batch_id, pc.id, coalesce(pc.number_of_people, 0), coalesce(pc.price_per_person, 0),
         coalesce(pc.number_of_people, 0) * coalesce(pc.price_per_person, 0)
  FROM public.proposal_compositions pc
  WHERE pc.id = ANY(p_composition_ids);

  -- Nº do pedido de compras é do CONTRATO: informado uma vez, fica salvo
  IF nullif(btrim(coalesce(p_purchase_order_number, '')), '') IS NOT NULL
     AND v_prop.client_po_number IS DISTINCT FROM btrim(p_purchase_order_number) THEN
    UPDATE public.proposals SET client_po_number = btrim(p_purchase_order_number)
    WHERE id = p_proposal_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id,
    'total_quantity', v_qty, 'total_value', v_val);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_proposal_billing(uuid, uuid[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_proposal_billing(uuid, uuid[], text, text) TO authenticated;

-- ── Transições do funil ────────────────────────────────────────────────
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
      IF v_batch.status NOT IN ('preparada', 'reprovada') THEN
        RAISE EXCEPTION 'Só é possível solicitar aprovação de um faturamento preparado ou reprovado (status: %)', v_batch.status;
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
        'Faturamento ' || coalesce(v_prop.event_name, 'contrato') || ' — Prop. ' || v_prop.proposal_number
          || ' (' || v_batch.total_quantity || ' un)',
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
      -- Caminho T09 do Zeev: NF/solicitação reprovada — corrigir e resolicitar
      IF v_batch.status NOT IN ('aguardando_aprovacao', 'aprovada_faturamento', 'faturada') THEN
        RAISE EXCEPTION 'Status % não permite reprovação', v_batch.status;
      END IF;
      UPDATE public.proposal_billing_batches
      SET status = 'reprovada',
          rejected_reason = nullif(btrim(coalesce(p_payload->>'reason', '')), ''),
          updated_at = now()
      WHERE id = p_batch_id;

    WHEN 'cancelar' THEN
      -- Libera os fornecimentos; permitido até antes da NF existir
      IF v_batch.status NOT IN ('preparada', 'aguardando_aprovacao', 'aprovada_faturamento', 'reprovada') THEN
        RAISE EXCEPTION 'Faturamento com NF emitida não pode ser cancelado por aqui — estorno é fluxo contábil';
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

REVOKE EXECUTE ON FUNCTION public.update_billing_status(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_billing_status(uuid, text, jsonb) TO authenticated;

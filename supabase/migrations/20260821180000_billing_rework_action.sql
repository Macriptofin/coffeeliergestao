-- Retrabalho de NF reprovada (21/ago/2026) — caso real T09 da CMPC: fluxo de
-- lançamento criado errado pelo cliente → NF reprovada sem culpa da Coffeelier
-- → cliente cria pedido de compras NOVO → nova solicitação → NF nova.
--
-- Desenho validado com o usuário: o LOTE é reaproveitado (mesmos fornecimentos,
-- o agrupamento não muda) — o que morre é o ciclo documental (pedido, Zeev, NF).
--
-- Mudanças em update_billing_status:
-- 1) 'reprovar' agora CANCELA a conta a receber automaticamente (status
--    'Cancelado', nunca excluída): a AR nasceu da NF emitida; reprovada, essa
--    NF morre (cancelada na prefeitura e reemitida com outro número) — manter
--    a AR viva é cobrança fantasma, e o refaturamento criaria uma SEGUNDA AR
--    (dupla cobrança). Seguro: pré-lançamento nunca tem recebimento (guarda).
-- 2) Ação nova 'retrabalhar' (reprovada → preparada): registra o ciclo morto
--    nas observações, aceita o nº do pedido novo, zera os campos do ciclo
--    (Zeev, NF, datas, AR) e devolve o lote ao início do funil.
-- 3) 'solicitar' deixa de aceitar lote reprovado direto (agora o caminho é
--    retrabalhar primeiro — senão os campos do ciclo morto ficavam pendurados).
-- 4) 'cancelar' também cancela a AR (cinto de segurança p/ lotes reprovados
--    de antes desta migration, que ficaram com AR viva).

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

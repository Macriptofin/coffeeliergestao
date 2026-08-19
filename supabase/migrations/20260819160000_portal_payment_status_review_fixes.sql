-- Correções da revisão adversarial do status de pagamento no portal (19/ago/2026).
--
-- 1) payment_summary tratava qualquer proposta cuja ÚNICA cobrança vinculada
--    estivesse 'Cancelado' como 'Pago' (o CASE só cobria Vencido/Pendente/
--    Parcial, caindo no ELSE) — e somava o valor cancelado em billed_total.
--    Corrigido excluindo 'Cancelado' do subselect inteiro: uma cobrança
--    cancelada não é "paga" nem "em aberto", é como se não existisse pro
--    portal (se só houver cancelada, a proposta simplesmente não ganha selo).
-- 2) next_due_date (e, por consistência, o branch "Em aberto") não exigiam
--    remaining_amount > 0 — só o branch "Vencido" tinha essa guarda. Uma
--    conta com status desatualizado (saldo já zerado manualmente, sem trocar
--    o dropdown de status) podia devolver uma data de vencimento fantasma.

CREATE OR REPLACE FUNCTION public.get_portal_proposals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_result jsonb;
  v_today  date := (now() at time zone 'America/Sao_Paulo')::date;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'proposal_number', p.proposal_number,
    'event_name', p.event_name, 'event_category', p.event_category,
    'event_date', p.event_date, 'number_of_people', p.number_of_people,
    'total_amount', p.total_amount, 'status', p.status, 'created_at', p.created_at,
    'created_by_client', p.created_by_client,
    'is_umbrella', p.is_umbrella,
    'umbrella_quota_quantity', p.umbrella_quota_quantity,
    'umbrella_quota_unit_price', p.umbrella_quota_unit_price,
    'consumed_quantity', CASE WHEN p.is_umbrella THEN
        (SELECT COALESCE(sum(pc.number_of_people), 0)
         FROM public.proposal_compositions pc WHERE pc.proposal_id = p.id)
      ELSE NULL END,
    'next_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT min(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id AND pc.scheduled_date >= v_today)
      ELSE NULL END,
    'last_execution_date', CASE WHEN p.is_umbrella THEN
        (SELECT max(pc.scheduled_date) FROM public.proposal_compositions pc
         WHERE pc.proposal_id = p.id)
      ELSE NULL END,
    'payment_summary', (
      SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
        'billed_total', COALESCE(sum(ar.original_amount), 0),
        'open_amount', COALESCE(sum(ar.remaining_amount) FILTER (WHERE ar.status IN ('Pendente','Parcial','Vencido') AND ar.remaining_amount > 0), 0),
        'overdue_amount', COALESCE(sum(ar.remaining_amount) FILTER (WHERE ar.status = 'Vencido' AND ar.remaining_amount > 0), 0),
        'next_due_date', min(ar.due_date) FILTER (WHERE ar.status IN ('Pendente','Parcial','Vencido') AND ar.remaining_amount > 0),
        'payment_status', CASE
          WHEN count(*) FILTER (WHERE ar.status = 'Vencido' AND ar.remaining_amount > 0) > 0 THEN 'Vencido'
          WHEN count(*) FILTER (WHERE ar.status IN ('Pendente','Parcial') AND ar.remaining_amount > 0) > 0 THEN 'Em aberto'
          ELSE 'Pago' END
      ) END
      FROM public.accounts_receivable ar
      -- Cobrança cancelada não conta como pagamento nem como pendência —
      -- exclui do subselect inteiro (senão vira 'Pago' pelo ELSE indevido).
      WHERE ar.proposal_id = p.id AND ar.status <> 'Cancelado'
    )
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.proposals p
  WHERE p.client_id = v_client AND p.portal_created_by = auth.uid();
  RETURN v_result;
END;
$function$;

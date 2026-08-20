-- request_proposal_change: guarda de prazo mínimo ignora a composição-molde
-- de proposta guarda-chuva (20/ago/2026).
--
-- A guarda de 24h (portal.prazo_minimo_horas) olha o momento mais próximo da
-- proposta. Numa guarda-chuva, a molde é template — a data dela é um resquício
-- sem significado operacional (no teste real da CMPC, a molde tinha data no
-- passado e QUALQUER pedido de alteração do contrato era recusado com a
-- mensagem de antecedência). Passa a computar o prazo só sobre as execuções
-- reais (mesmo critério de exclusão da molde das demais funções: menor
-- sort_order). Proposta normal: comportamento inalterado.

CREATE OR REPLACE FUNCTION public.request_proposal_change(p_proposal_id uuid, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid;
  v_is_umbrella boolean;
  v_prazo_horas numeric;
  v_earliest timestamp;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Acesso não autorizado.');
  END IF;
  IF p_message IS NULL OR length(btrim(p_message)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Descreva a alteração desejada.');
  END IF;
  SELECT is_umbrella INTO v_is_umbrella
  FROM public.proposals WHERE id = p_proposal_id AND client_id = v_client;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Proposta não encontrada.');
  END IF;

  -- Mesmo prazo mínimo do pedido: não faz sentido pedir alteração de algo que já vai acontecer.
  -- Guarda-chuva: a molde (menor sort_order) é template, fica fora do cálculo.
  SELECT min(scheduled_date + COALESCE(scheduled_time, '00:00'::time))
    INTO v_earliest
  FROM public.proposal_compositions pc
  WHERE pc.proposal_id = p_proposal_id
    AND pc.scheduled_date IS NOT NULL
    AND (NOT coalesce(v_is_umbrella, false)
         OR pc.id <> (SELECT t.id FROM public.proposal_compositions t
                      WHERE t.proposal_id = p_proposal_id
                      ORDER BY t.sort_order ASC LIMIT 1));

  IF v_earliest IS NOT NULL THEN
    SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'portal.prazo_minimo_horas')::numeric, 24)
      INTO v_prazo_horas;
    IF v_earliest < ((now() AT TIME ZONE 'America/Sao_Paulo') + (v_prazo_horas || ' hours')::interval) THEN
      RETURN jsonb_build_object('success', false,
        'message', format('Alterações só podem ser solicitadas com pelo menos %s horas de antecedência do evento. Fale diretamente com a equipe Coffeelier.', v_prazo_horas));
    END IF;
  END IF;

  INSERT INTO public.proposal_change_requests (proposal_id, client_id, requested_by, message)
  VALUES (p_proposal_id, v_client, auth.uid(), btrim(p_message));
  RETURN jsonb_build_object('success', true, 'message', 'Solicitação enviada à nossa equipe.');
END;
$function$;

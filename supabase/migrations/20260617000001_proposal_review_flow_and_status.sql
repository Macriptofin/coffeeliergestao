-- Padroniza status de proposta (PT, capitalizado) e introduz a etapa de revisão.
-- Conjunto canônico: Rascunho, Enviada, 'Aprovada pelo Cliente', Aprovada, Rejeitada, Cancelada.

-- 1) Normaliza valores existentes (estavam misturados maiúsc/minúsc)
UPDATE public.proposals SET status = 'Aprovada'  WHERE lower(status) = 'aprovada';
UPDATE public.proposals SET status = 'Enviada'   WHERE lower(status) = 'enviada';
UPDATE public.proposals SET status = 'Rascunho'  WHERE lower(status) = 'rascunho';
UPDATE public.proposals SET status = 'Rejeitada' WHERE lower(status) = 'rejeitada';
UPDATE public.proposals SET status = 'Cancelada' WHERE lower(status) = 'cancelada';

-- 2) Aprovação do cliente = ACEITE comercial (NÃO gera evento/produção).
--    A geração passa a ocorrer só na aprovação final da equipe (após revisão).
CREATE OR REPLACE FUNCTION public.approve_proposal_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal_id uuid;
  v_status      text;
BEGIN
  SELECT proposal_id INTO v_proposal_id
  FROM proposal_approval_tokens
  WHERE token = p_token AND expires_at > now() AND used_at IS NULL;

  IF v_proposal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido, expirado ou já utilizado');
  END IF;

  SELECT status INTO v_status FROM proposals WHERE id = v_proposal_id;
  IF v_status IN ('Aprovada pelo Cliente', 'Aprovada') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Proposta já estava aceita');
  END IF;

  UPDATE proposal_approval_tokens SET used_at = now() WHERE token = p_token;

  -- ACEITE do cliente — NÃO gera evento nem produção (isso é na revisão final da equipe)
  UPDATE proposals SET status = 'Aprovada pelo Cliente', updated_at = now() WHERE id = v_proposal_id;

  RETURN jsonb_build_object(
    'success',     true,
    'message',     'Proposta aceita! Nossa equipe fará a revisão final e a confirmação.',
    'proposal_id', v_proposal_id
  );
END;
$function$;

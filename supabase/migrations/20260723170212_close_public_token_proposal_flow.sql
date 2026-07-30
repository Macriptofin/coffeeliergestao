-- Fecha o modelo antigo de aprovação por link público sem login (/aprovar/:token).
-- Decisão de produto: acesso do cliente à proposta é sempre pelo Portal autenticado.

-- 1. Revoga EXECUTE de PUBLIC (cobre anon + authenticated — REVOKE FROM anon sozinho não
--    basta se o ACL concede a PUBLIC, lição já registrada em db-security-hardening-jul2026).
REVOKE EXECUTE ON FUNCTION public.get_proposal_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_proposal_by_token(text) FROM PUBLIC;

-- 2. Invalida (soft) qualquer token já emitido — nunca excluir, só desativar.
UPDATE public.proposal_approval_tokens SET used_at = now() WHERE used_at IS NULL;

-- 3. Defesa em profundidade: approve_proposal_as_client (Portal autenticado) passa a exigir
--    também que o usuário logado seja o dono da visibilidade (portal_created_by), não só
--    que ele seja 'aprovador' do cliente certo. Hoje só o front garantia isso via
--    get_portal_proposal já ter filtrado por portal_created_by.
CREATE OR REPLACE FUNCTION public.approve_proposal_as_client(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_client uuid; v_role text; v_status text;
BEGIN
  SELECT client_id, portal_role INTO v_client, v_role
    FROM public.client_users WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Acesso não autorizado.');
  END IF;
  IF v_role <> 'aprovador' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Seu perfil não tem permissão para aprovar. Solicite a um aprovador da sua empresa.');
  END IF;
  SELECT status INTO v_status FROM public.proposals
    WHERE id = p_proposal_id AND client_id = v_client AND portal_created_by = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Proposta não encontrada.');
  END IF;
  IF v_status IN ('Aprovada pelo Cliente', 'Aprovada') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Proposta já aprovada.', 'proposal_id', p_proposal_id);
  END IF;
  IF v_status <> 'Enviada' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta proposta não está disponível para aprovação.');
  END IF;
  UPDATE public.proposals
     SET status = 'Aprovada pelo Cliente', approved_at = now(), updated_at = now()
   WHERE id = p_proposal_id;
  RETURN jsonb_build_object('success', true,
    'message', 'Pedido aprovado! Nossa equipe fará a confirmação final.', 'proposal_id', p_proposal_id);
END;
$function$;

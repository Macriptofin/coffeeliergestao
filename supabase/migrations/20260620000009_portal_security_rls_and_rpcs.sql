-- PORTAL DO CLIENTE — Fase 1, etapa 2: segurança (RLS aditivo + RPCs com posse).

-- Helper: usuário interno = autenticado que NÃO é cliente de portal.
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT auth.uid() IS NOT NULL AND NOT public.is_portal_client(); $$;

-- FIX de vazamento: proposal_revisions tinha policy permissiva USING(true) p/ authenticated.
-- Com clientes logados isso exporia revisões de TODOS. Escopar: interno vê tudo; cliente só as suas.
DROP POLICY IF EXISTS proposal_revisions_all ON public.proposal_revisions;
CREATE POLICY proposal_revisions_internal ON public.proposal_revisions
  FOR ALL TO authenticated
  USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY proposal_revisions_portal_read ON public.proposal_revisions
  FOR SELECT TO authenticated
  USING (proposal_id IN (SELECT id FROM public.proposals WHERE client_id = public.current_portal_client_id()));

-- RLS das tabelas novas
CREATE POLICY client_users_internal ON public.client_users
  FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY client_users_self_read ON public.client_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY pcr_internal ON public.proposal_change_requests
  FOR ALL TO authenticated USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
CREATE POLICY pcr_portal_read ON public.proposal_change_requests
  FOR SELECT TO authenticated USING (client_id = public.current_portal_client_id());
CREATE POLICY pcr_portal_insert ON public.proposal_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_portal_client_id() AND requested_by = auth.uid());

-- Leitura aditiva da estrutura do cliente (sem dado sensível de custo) — o cliente só enxerga o seu.
CREATE POLICY clients_portal_read ON public.clients
  FOR SELECT TO authenticated USING (id = public.current_portal_client_id());
CREATE POLICY client_units_portal_read ON public.client_units
  FOR SELECT TO authenticated USING (client_id = public.current_portal_client_id());
CREATE POLICY client_departments_portal_read ON public.client_departments
  FOR SELECT TO authenticated USING (client_id = public.current_portal_client_id());
CREATE POLICY client_rooms_portal_read ON public.client_rooms
  FOR SELECT TO authenticated USING (client_id = public.current_portal_client_id());
CREATE POLICY client_contacts_portal_read ON public.client_contacts
  FOR SELECT TO authenticated USING (client_id = public.current_portal_client_id());

-- RPC: cliente aprova a própria proposta (gate interno mantido → 'Aprovada pelo Cliente').
-- Só 'aprovador' aprova. Checagem de posse pelo client_id do usuário logado.
CREATE OR REPLACE FUNCTION public.approve_proposal_as_client(p_proposal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  SELECT status INTO v_status FROM public.proposals WHERE id = p_proposal_id AND client_id = v_client;
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
$$;

-- RPC: cliente solicita alteração na proposta.
CREATE OR REPLACE FUNCTION public.request_proposal_change(p_proposal_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client uuid;
BEGIN
  v_client := public.current_portal_client_id();
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Acesso não autorizado.');
  END IF;
  IF p_message IS NULL OR length(btrim(p_message)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Descreva a alteração desejada.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_proposal_id AND client_id = v_client) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Proposta não encontrada.');
  END IF;
  INSERT INTO public.proposal_change_requests (proposal_id, client_id, requested_by, message)
  VALUES (p_proposal_id, v_client, auth.uid(), btrim(p_message));
  RETURN jsonb_build_object('success', true, 'message', 'Solicitação enviada à nossa equipe.');
END;
$$;

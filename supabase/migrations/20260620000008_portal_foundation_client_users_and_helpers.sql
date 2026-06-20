-- PORTAL DO CLIENTE — Fase 1, etapa 1: fundação de dados.
-- Tudo aditivo. Não altera políticas/colunas existentes do fluxo interno.

-- 1) Tipo de usuário: interno (equipe) vs client (portal). Default 'internal' cobre todos os atuais.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'internal'
  CHECK (user_type IN ('internal','client'));

-- 2) Vínculo login↔cliente (o usuário é convidado "através do cliente").
CREATE TABLE IF NOT EXISTS public.client_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_role text NOT NULL DEFAULT 'solicitante' CHECK (portal_role IN ('solicitante','aprovador')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid
);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON public.client_users(client_id);
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- 3) Snapshot da condição de pagamento na proposta (faturamento como serviço, por cliente).
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS payment_terms text;

-- 4) Fluxo de aprovação de locais sugeridos pelo cliente (sala/prédio).
--    Linhas existentes nascem 'approved'; sugestões do portal entrarão como 'pending'.
ALTER TABLE public.client_units
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz;
ALTER TABLE public.client_rooms
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz;

-- 5) Pedidos de alteração do cliente sobre uma proposta (botão "Solicitar alteração").
CREATE TABLE IF NOT EXISTS public.proposal_change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid,
  message      text NOT NULL,
  status       text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida','recusada')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid
);
CREATE INDEX IF NOT EXISTS idx_change_requests_proposal ON public.proposal_change_requests(proposal_id);
ALTER TABLE public.proposal_change_requests ENABLE ROW LEVEL SECURITY;

-- 6) Helpers de identidade do portal (SECURITY DEFINER, search_path fixo).
CREATE OR REPLACE FUNCTION public.current_portal_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT client_id FROM public.client_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_portal_client()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

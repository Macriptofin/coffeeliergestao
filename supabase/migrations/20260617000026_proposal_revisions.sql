-- Revisões de proposta (modelo A): mesmo código, contador de revisão + snapshot
-- por envio. Cada reenvio incrementa proposals.revision e grava um snapshot do que
-- foi enviado (auditoria do "o que mudou entre revisões").
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.proposal_revisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  revision         integer NOT NULL,
  total_amount     numeric,
  total_cost       numeric,
  total_weight     numeric,
  number_of_people integer,
  event_date       date,
  status           text,
  notes            text,
  data             jsonb,        -- snapshot completo (composições/itens) p/ auditoria
  created_by       uuid,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (proposal_id, revision)
);

ALTER TABLE public.proposal_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposal_revisions_all ON public.proposal_revisions;
CREATE POLICY proposal_revisions_all ON public.proposal_revisions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_proposal_revisions_proposal ON public.proposal_revisions(proposal_id);

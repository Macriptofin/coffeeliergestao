-- Fase 4: camada de COMPOSIÇÃO (momento de serviço) da proposta.
-- Uma proposta tem N composições (ex.: "Welcome Coffee", "Coffee Break Manhã"),
-- cada uma com data/hora própria (suporta evento multi-dia) e preço por pessoa.
-- As seções (proposal_categories) passam a pertencer a uma composição.

CREATE TABLE IF NOT EXISTS proposal_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  name text NOT NULL,
  scheduled_date date,
  scheduled_time time,
  location text,
  number_of_people integer,
  price_per_person numeric,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proposal_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage proposal_compositions" ON proposal_compositions
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_proposal_compositions_proposal
  ON proposal_compositions(proposal_id, sort_order);

ALTER TABLE proposal_categories
  ADD COLUMN IF NOT EXISTS composition_id uuid REFERENCES proposal_compositions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_proposal_categories_composition
  ON proposal_categories(composition_id);

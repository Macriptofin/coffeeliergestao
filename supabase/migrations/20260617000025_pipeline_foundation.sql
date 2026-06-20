-- Pipeline de vendas (funil). O status da proposta já é o estágio do funil.
-- Adiciona: custo total (p/ margem no funil), motivo de perda, data de aprovação
-- (p/ ciclo de vendas), e probabilidades por estágio (forecast).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS total_cost  numeric,     -- custo total (insumos+frete) p/ margem
  ADD COLUMN IF NOT EXISTS loss_reason text,        -- motivo quando Rejeitada/Cancelada
  ADD COLUMN IF NOT EXISTS approved_at timestamptz; -- quando virou Aprovada (ciclo de vendas)

-- Carimba approved_at na transição para 'Aprovada' (qualquer caminho de aprovação).
CREATE OR REPLACE FUNCTION public.set_proposal_approved_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'Aprovada'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Aprovada')
     AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proposal_approved_at ON public.proposals;
CREATE TRIGGER trg_proposal_approved_at
BEFORE INSERT OR UPDATE OF status ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_proposal_approved_at();

-- Probabilidades por estágio (forecast) — editáveis em Configurações > Vendas.
INSERT INTO public.app_settings (key, value) VALUES
  ('pipeline.prob_rascunho',          '0.10'),
  ('pipeline.prob_enviada',           '0.40'),
  ('pipeline.prob_aprovada_cliente',  '0.80')
ON CONFLICT (key) DO NOTHING;

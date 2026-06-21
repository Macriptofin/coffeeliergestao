-- Regime de COMPETÊNCIA: a receita/despesa pertence ao mês da ENTREGA do serviço,
-- não da emissão nem do vencimento. competence_date torna isso explícito e editável.
-- Default = issue_date (melhor aproximação para registros existentes); para receitas de
-- evento, deve ser a data do evento. O prazo de pagamento (due_date) rege só o CAIXA.
ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS competence_date date;
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS competence_date date;

UPDATE public.accounts_receivable SET competence_date = issue_date WHERE competence_date IS NULL;
UPDATE public.accounts_payable    SET competence_date = issue_date WHERE competence_date IS NULL;

CREATE OR REPLACE FUNCTION public.default_competence_date()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.competence_date IS NULL THEN
    NEW.competence_date := NEW.issue_date;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_default_competence_ar ON public.accounts_receivable;
CREATE TRIGGER trg_default_competence_ar
BEFORE INSERT OR UPDATE OF issue_date, competence_date ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.default_competence_date();

DROP TRIGGER IF EXISTS trg_default_competence_ap ON public.accounts_payable;
CREATE TRIGGER trg_default_competence_ap
BEFORE INSERT OR UPDATE OF issue_date, competence_date ON public.accounts_payable
FOR EACH ROW EXECUTE FUNCTION public.default_competence_date();

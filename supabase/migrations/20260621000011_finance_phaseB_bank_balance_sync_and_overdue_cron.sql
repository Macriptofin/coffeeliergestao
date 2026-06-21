-- B1: SALDO BANCÁRIO SINCRONIZADO COM O CAIXA + B2: STATUS "VENCIDO" DIÁRIO (pg_cron).
-- current_balance = initial_balance + Σ(Entradas) − Σ(Saídas) das cash_transactions da conta.
CREATE OR REPLACE FUNCTION public.recompute_bank_balance(p_bank_account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_init numeric; v_net numeric;
BEGIN
  IF p_bank_account_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(initial_balance,0) INTO v_init FROM public.bank_accounts WHERE id = p_bank_account_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(CASE WHEN transaction_type='Entrada' THEN amount
                           WHEN transaction_type='Saída'   THEN -amount ELSE 0 END),0)
    INTO v_net FROM public.cash_transactions WHERE bank_account_id = p_bank_account_id;
  UPDATE public.bank_accounts SET current_balance = v_init + v_net, updated_at = now()
   WHERE id = p_bank_account_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.trg_sync_bank_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF TG_OP='UPDATE' AND NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id THEN
    PERFORM public.recompute_bank_balance(OLD.bank_account_id);
    PERFORM public.recompute_bank_balance(NEW.bank_account_id);
  ELSIF TG_OP='DELETE' THEN
    PERFORM public.recompute_bank_balance(OLD.bank_account_id);
  ELSE
    PERFORM public.recompute_bank_balance(NEW.bank_account_id);
  END IF;
  RETURN NULL;
END; $function$;
DROP TRIGGER IF EXISTS trg_sync_bank_balance ON public.cash_transactions;
CREATE TRIGGER trg_sync_bank_balance
AFTER INSERT OR UPDATE OR DELETE ON public.cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_bank_balance();

CREATE OR REPLACE FUNCTION public.trg_bank_initial_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN PERFORM public.recompute_bank_balance(NEW.id); RETURN NULL; END; $function$;
DROP TRIGGER IF EXISTS trg_bank_initial_balance ON public.bank_accounts;
CREATE TRIGGER trg_bank_initial_balance
AFTER UPDATE OF initial_balance ON public.bank_accounts
FOR EACH ROW WHEN (NEW.initial_balance IS DISTINCT FROM OLD.initial_balance)
EXECUTE FUNCTION public.trg_bank_initial_balance();

DO $$ DECLARE b record; BEGIN
  FOR b IN SELECT id FROM public.bank_accounts LOOP
    PERFORM public.recompute_bank_balance(b.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_overdue_status()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  UPDATE public.accounts_receivable SET status='Vencido', updated_at=now()
   WHERE status='Pendente' AND COALESCE(remaining_amount,0)>0 AND due_date < CURRENT_DATE;
  UPDATE public.accounts_payable SET status='Vencido', updated_at=now()
   WHERE status='Pendente' AND COALESCE(remaining_amount,0)>0 AND due_date < CURRENT_DATE;
END; $function$;

SELECT public.refresh_overdue_status();
SELECT cron.schedule('refresh-overdue-status-daily', '0 6 * * *',
  $$ SELECT public.refresh_overdue_status(); $$);

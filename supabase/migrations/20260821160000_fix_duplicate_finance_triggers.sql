-- Correção de triggers financeiros duplicados/legados (21/ago/2026).
-- Achados durante o teste com rollback do recebimento do faturamento — um
-- recebimento de R$ 370,80 movia o saldo bancário em R$ 741,60 (o dobro).
--
-- 1) cash_transactions tinha DOIS triggers de saldo: trg_sync_bank_balance
--    (oficial da reforma de jun/2026 — recompute do zero) e
--    trigger_update_bank_balance (LEGADO incremental, anterior à reforma,
--    nunca removido). Ordem alfabética: o recompute rodava primeiro e o
--    legado somava o movimento DE NOVO por cima — todo movimento de caixa
--    dobrado no saldo armazenado. Defasagem real medida em produção no
--    momento do fix: Principal em -24.641,09 vs correto -24.377,87
--    (R$ 263,22 de drift). Legado removido (trigger + função, sem outro uso).
--
-- 2) receipt_transactions e payment_transactions tinham CADA UMA dois
--    triggers pra mesma função de recálculo de saldo da conta
--    (trg_update_*_remaining, só INSERT, subconjunto do
--    trigger_update_*_remaining_amount, INSERT/UPDATE/DELETE). Duplicatas
--    de INSERT removidas. E as funções referenciavam NEW em DELETE — NEW
--    não existe em AFTER DELETE (mesma classe do bug de
--    trigger_sync_stock_quantity, jul/2026): qualquer estorno/exclusão de
--    recebimento ou pagamento estourava erro. Corrigidas p/ CASE TG_OP.
--
-- 3) Saldos de todas as contas recalculados pela fórmula oficial.

-- ── 1) Trigger legado de saldo ─────────────────────────────────────────
DROP TRIGGER trigger_update_bank_balance ON public.cash_transactions;
DROP FUNCTION public.update_bank_account_balance();

-- ── 2) Duplicatas de INSERT + fix de DELETE ────────────────────────────
DROP TRIGGER trg_update_receivable_remaining ON public.receipt_transactions;
DROP TRIGGER trg_update_payable_remaining ON public.payment_transactions;

CREATE OR REPLACE FUNCTION public.update_receivable_remaining_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Em AFTER DELETE, NEW não existe — usar OLD (fix 21/ago/2026)
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.account_receivable_id ELSE NEW.account_receivable_id END;

  UPDATE public.accounts_receivable
  SET
    received_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.receipt_transactions
      WHERE account_receivable_id = v_id
    ),
    remaining_amount = original_amount + interest_amount - discount_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.receipt_transactions
      WHERE account_receivable_id = v_id
    ),
    status = CASE
      WHEN (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.receipt_transactions
        WHERE account_receivable_id = v_id
      )) <= 0 THEN 'Recebido'
      WHEN due_date < CURRENT_DATE AND (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.receipt_transactions
        WHERE account_receivable_id = v_id
      )) > 0 THEN 'Vencido'
      ELSE 'Pendente'
    END,
    updated_at = now()
  WHERE id = v_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payable_remaining_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  -- Em AFTER DELETE, NEW não existe — usar OLD (fix 21/ago/2026)
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.account_payable_id ELSE NEW.account_payable_id END;

  UPDATE public.accounts_payable
  SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.payment_transactions
      WHERE account_payable_id = v_id
    ),
    remaining_amount = original_amount + interest_amount - discount_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.payment_transactions
      WHERE account_payable_id = v_id
    ),
    status = CASE
      WHEN (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.payment_transactions
        WHERE account_payable_id = v_id
      )) <= 0 THEN 'Pago'
      WHEN due_date < CURRENT_DATE AND (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM public.payment_transactions
        WHERE account_payable_id = v_id
      )) > 0 THEN 'Vencido'
      ELSE 'Pendente'
    END,
    updated_at = now()
  WHERE id = v_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- ── 3) Repara os saldos armazenados (fórmula oficial) ──────────────────
SELECT public.recompute_bank_balance(id) FROM public.bank_accounts;

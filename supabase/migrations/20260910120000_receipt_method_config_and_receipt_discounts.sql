-- Recebimento manual (Contas a Receber → "Receber") quebrava em produção — achado de 10/09/2026 ao baixar a NFS-e antecipada pela Monkey.
-- Raiz 1: receipt_transactions.receipt_method tinha CHECK com lista fixa (Dinheiro/PIX/Cartão Débito/Cartão Crédito/Transferência/Boleto/Cheque),
--         enquanto o diálogo lista as formas configuradas em Configurações (payment_methods: "Transferência Bancária", "Cartão de Crédito"…).
--         Duas fontes de verdade → "Transferência Bancária" violava a constraint. A fonte passa a ser só o cadastro.
-- Raiz 2: o trigger que recalcula a conta a receber ignorava desconto/juros lançados NO RECIBO (discount_amount/interest_amount de
--         receipt_transactions) — um recebimento líquido com deságio de antecipação nunca liquidava a conta (sobrava o valor do deságio).
--         O front tentava compensar com UPDATE manual (status 'Pago'/'Parcial', que nem existem no CHECK de accounts_receivable, e
--         somava o saldo bancário de novo por cima do trigger). O front deixa de fazer isso; o trigger passa a ser o único dono.

alter table public.receipt_transactions drop constraint if exists receipt_transactions_receipt_method_check;

CREATE OR REPLACE FUNCTION public.update_receivable_remaining_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_cash numeric; v_settled numeric; v_last date;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.account_receivable_id ELSE NEW.account_receivable_id END;

  -- v_cash = o que entrou em caixa; v_settled = quanto da conta foi liquidado (caixa + desconto concedido − juros recebidos a mais)
  SELECT COALESCE(SUM(amount), 0),
         COALESCE(SUM(amount + COALESCE(discount_amount, 0) - COALESCE(interest_amount, 0)), 0),
         MAX(receipt_date)
    INTO v_cash, v_settled, v_last
  FROM public.receipt_transactions WHERE account_receivable_id = v_id;

  UPDATE public.accounts_receivable
  SET
    received_amount  = v_cash,
    remaining_amount = original_amount + interest_amount - discount_amount - v_settled,
    status = CASE
      WHEN (original_amount + interest_amount - discount_amount - v_settled) <= 0.005 THEN 'Recebido'
      WHEN due_date < CURRENT_DATE THEN 'Vencido'
      ELSE 'Pendente'
    END,
    receipt_date = CASE
      WHEN (original_amount + interest_amount - discount_amount - v_settled) <= 0.005 THEN COALESCE(receipt_date, v_last)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Backfill 1: contas que já tinham recibo com desconto/juros ficam com saldo recalculado pela regra nova (dispara o trigger sem mudar dados)
UPDATE public.receipt_transactions SET amount = amount
WHERE account_receivable_id IN (
  SELECT DISTINCT account_receivable_id FROM public.receipt_transactions
  WHERE COALESCE(discount_amount, 0) <> 0 OR COALESCE(interest_amount, 0) <> 0
);

-- Backfill 2: contas recebidas sem data de recebimento recebem a data do último recibo (mesmo ajuste feito em accounts_payable em 05/09)
UPDATE public.accounts_receivable ar
SET receipt_date = rt.last_rc
FROM (SELECT account_receivable_id, MAX(receipt_date) AS last_rc FROM public.receipt_transactions GROUP BY account_receivable_id) rt
WHERE rt.account_receivable_id = ar.id AND ar.status = 'Recebido' AND ar.receipt_date IS NULL;

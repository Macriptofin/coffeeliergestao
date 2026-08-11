-- BUG CRÍTICO (achado 08/ago/2026), dois problemas independentes na mesma
-- migration de origem (20260621000012_cash_transactions_carry_bank_account),
-- que juntos derrubavam TODO INSERT em payment_transactions silenciosamente:
--
-- 1) payment_transactions nunca teve a coluna bank_account_id (só um
--    "bank_account" texto solto, nunca migrado pro padrão das tabelas irmãs).
--    O trigger insert_cash_on_payment passou a referenciar NEW.bank_account_id,
--    que não existia — erro "record NEW has no field bank_account_id".
-- 2) A mesma migration também trocou o literal 'Manual' (usado em 228 linhas
--    históricas de cash_transactions e na constraint cash_transactions_
--    reference_type_check) por 'manual' minúsculo dentro do trigger — viola a
--    CHECK constraint. Achado ao testar a correção do item 1 (o INSERT chegou
--    a rodar e caiu direto nessa segunda violação).
--
-- Confirmado: nenhum payment_transactions bem-sucedido desde 21/jun (7 semanas).
-- insert_cash_on_receipt tem o mesmo bug de casing (não travado ainda por falta
-- de uso — nenhum recebimento desde abril) — corrigido preventivamente junto.
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id);

COMMENT ON COLUMN public.payment_transactions.bank_account_id IS
  'Substitui bank_account (texto solto, nunca era FK de verdade) — trigger insert_cash_on_payment lê daqui.';

-- Backfill: só 2 linhas antigas tinham um uuid válido guardado na coluna de texto.
UPDATE public.payment_transactions
SET bank_account_id = bank_account::uuid
WHERE bank_account IS NOT NULL
  AND bank_account_id IS NULL
  AND bank_account ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

CREATE OR REPLACE FUNCTION public.insert_cash_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_bank uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_transactions
      WHERE reference_type = 'Manual' AND reference_id = NEW.id
    ) THEN
      SELECT COALESCE(NEW.bank_account_id, ap.bank_account_id,
                      (SELECT id FROM public.bank_accounts WHERE is_default AND is_active LIMIT 1))
        INTO v_bank
      FROM public.accounts_payable ap WHERE ap.id = NEW.account_payable_id;

      INSERT INTO public.cash_transactions (
        transaction_date, description, transaction_type, category,
        amount, payment_method, bank_account_id, cost_center_id,
        account_id, document_number, notes, reference_type, reference_id
      )
      SELECT
        NEW.payment_date,
        COALESCE('Pagamento - ' || s.company_name || ' - ' || ap.description, 'Pagamento de conta a pagar'),
        'Saída', 'Pagamentos',
        NEW.amount, NEW.payment_method, v_bank,
        ap.cost_center_id, ap.account_id, ap.document_number,
        COALESCE(NEW.notes, ''),
        'Manual', NEW.id
      FROM public.accounts_payable ap
      LEFT JOIN public.suppliers s ON s.id = ap.supplier_id
      WHERE ap.id = NEW.account_payable_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_transactions
    SET
      transaction_date = NEW.payment_date,
      amount           = NEW.amount,
      payment_method   = NEW.payment_method,
      bank_account_id  = COALESCE(NEW.bank_account_id, bank_account_id),
      notes            = COALESCE(NEW.notes, notes),
      updated_at       = now()
    WHERE reference_type = 'Manual' AND reference_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_cash_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_bank uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_transactions
    WHERE reference_type = 'Manual' AND reference_id = NEW.id
  ) THEN
    SELECT COALESCE(NEW.bank_account_id, ar.bank_account_id,
                    (SELECT id FROM public.bank_accounts WHERE is_default AND is_active LIMIT 1))
      INTO v_bank
    FROM public.accounts_receivable ar WHERE ar.id = NEW.account_receivable_id;

    INSERT INTO public.cash_transactions (
      transaction_date, description, transaction_type, category,
      amount, payment_method, bank_account_id, cost_center_id,
      account_id, document_number, notes, reference_type, reference_id
    )
    SELECT
      NEW.receipt_date,
      COALESCE('Recebimento - ' || c.name || ' - ' || ar.description, 'Recebimento de conta a receber'),
      'Entrada', 'Recebimentos',
      NEW.amount, NEW.receipt_method, v_bank,
      ar.cost_center_id, ar.account_id, ar.document_number,
      COALESCE(NEW.notes, ''),
      'Manual', NEW.id
    FROM public.accounts_receivable ar
    LEFT JOIN public.clients c ON c.id = ar.client_id
    WHERE ar.id = NEW.account_receivable_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill do pagamento real perdido hoje (NF 152115, R$110,81): dados
-- recuperados do próprio purchase_invoices.notes (forma de pagamento e data
-- capturadas na hora do lançamento, nunca persistidas por causa dos bugs acima).
INSERT INTO public.payment_transactions (account_payable_id, payment_date, amount, payment_method, notes)
VALUES (
  '8750677d-a11b-47bb-8f26-2173a8962a00',
  '2026-08-07',
  110.81,
  'cartao_debito',
  'Backfill: pagamento não entrou no Fluxo de Caixa por bug no trigger insert_cash_on_payment (bank_account_id inexistente + reference_type "manual"/"Manual" até 08/08/2026). Dados recuperados de purchase_invoices.notes.'
);

UPDATE public.accounts_payable
SET payment_date = '2026-08-07'
WHERE id = '8750677d-a11b-47bb-8f26-2173a8962a00';

-- Adjust triggers to use allowed reference_type and backfill cash based on payments/receipts only

-- Update function: insert cash transaction on payment (use reference_type 'manual')
CREATE OR REPLACE FUNCTION public.insert_cash_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_transactions 
    WHERE reference_type = 'manual' AND reference_id = NEW.id
  ) THEN
    INSERT INTO public.cash_transactions (
      transaction_date,
      description,
      transaction_type,
      category,
      amount,
      payment_method,
      bank_account,
      cost_center_id,
      account_id,
      document_number,
      notes,
      reference_type,
      reference_id
    )
    SELECT
      NEW.payment_date,
      COALESCE('Pagamento - ' || s.company_name || ' - ' || ap.description, 'Pagamento de conta a pagar'),
      'Saída',
      'Pagamentos',
      NEW.amount,
      NEW.payment_method,
      NULL,
      ap.cost_center_id,
      ap.account_id,
      ap.document_number,
      COALESCE(NEW.notes, ''),
      'manual',
      NEW.id
    FROM public.accounts_payable ap
    LEFT JOIN public.suppliers s ON s.id = ap.supplier_id
    WHERE ap.id = NEW.account_payable_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update function: insert cash transaction on receipt (use reference_type 'manual')
CREATE OR REPLACE FUNCTION public.insert_cash_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_transactions 
    WHERE reference_type = 'manual' AND reference_id = NEW.id
  ) THEN
    INSERT INTO public.cash_transactions (
      transaction_date,
      description,
      transaction_type,
      category,
      amount,
      payment_method,
      bank_account,
      cost_center_id,
      account_id,
      document_number,
      notes,
      reference_type,
      reference_id
    )
    SELECT
      NEW.receipt_date,
      COALESCE('Recebimento - ' || c.name || ' - ' || ar.description, 'Recebimento de conta a receber'),
      'Entrada',
      'Recebimentos',
      NEW.amount,
      NEW.receipt_method,
      NULL,
      ar.cost_center_id,
      ar.account_id,
      ar.document_number,
      COALESCE(NEW.notes, ''),
      'manual',
      NEW.id
    FROM public.accounts_receivable ar
    LEFT JOIN public.clients c ON c.id = ar.client_id
    WHERE ar.id = NEW.account_receivable_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate triggers (idempotent)
DROP TRIGGER IF EXISTS trg_cash_on_payment ON public.payment_transactions;
CREATE TRIGGER trg_cash_on_payment
AFTER INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.insert_cash_on_payment();

DROP TRIGGER IF EXISTS trg_cash_on_receipt ON public.receipt_transactions;
CREATE TRIGGER trg_cash_on_receipt
AFTER INSERT ON public.receipt_transactions
FOR EACH ROW EXECUTE FUNCTION public.insert_cash_on_receipt();

DROP TRIGGER IF EXISTS trg_update_payable_remaining ON public.payment_transactions;
CREATE TRIGGER trg_update_payable_remaining
AFTER INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_payable_remaining_amount();

DROP TRIGGER IF EXISTS trg_update_receivable_remaining ON public.receipt_transactions;
CREATE TRIGGER trg_update_receivable_remaining
AFTER INSERT ON public.receipt_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_receivable_remaining_amount();

-- Backfill based on payments
INSERT INTO public.cash_transactions (
  transaction_date, description, transaction_type, category, amount, payment_method, bank_account, cost_center_id, account_id, document_number, notes, reference_type, reference_id
)
SELECT
  pt.payment_date,
  COALESCE('Pagamento - ' || s.company_name || ' - ' || ap.description, 'Pagamento de conta a pagar'),
  'Saída',
  'Pagamentos',
  pt.amount,
  pt.payment_method,
  NULL,
  ap.cost_center_id,
  ap.account_id,
  ap.document_number,
  COALESCE(pt.notes, ''),
  'manual',
  pt.id
FROM public.payment_transactions pt
JOIN public.accounts_payable ap ON ap.id = pt.account_payable_id
LEFT JOIN public.suppliers s ON s.id = ap.supplier_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_transactions ct 
  WHERE ct.reference_type = 'manual' AND ct.reference_id = pt.id
);

-- Backfill based on receipts
INSERT INTO public.cash_transactions (
  transaction_date, description, transaction_type, category, amount, payment_method, bank_account, cost_center_id, account_id, document_number, notes, reference_type, reference_id
)
SELECT
  rt.receipt_date,
  COALESCE('Recebimento - ' || c.name || ' - ' || ar.description, 'Recebimento de conta a receber'),
  'Entrada',
  'Recebimentos',
  rt.amount,
  rt.receipt_method,
  NULL,
  ar.cost_center_id,
  ar.account_id,
  ar.document_number,
  COALESCE(rt.notes, ''),
  'manual',
  rt.id
FROM public.receipt_transactions rt
JOIN public.accounts_receivable ar ON ar.id = rt.account_receivable_id
LEFT JOIN public.clients c ON c.id = ar.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_transactions ct 
  WHERE ct.reference_type = 'manual' AND ct.reference_id = rt.id
);

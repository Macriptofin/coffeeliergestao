-- Caixa passa a carregar o BANCO do pagamento/recebimento (antes ficava NULL, por isso
-- o saldo bancário não fechava). Preferência: banco da transação → banco da conta → padrão.
CREATE OR REPLACE FUNCTION public.insert_cash_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_bank uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cash_transactions
                   WHERE reference_type='manual' AND reference_id=NEW.id) THEN
      SELECT COALESCE(NEW.bank_account_id, ap.bank_account_id,
                      (SELECT id FROM public.bank_accounts WHERE is_default AND is_active LIMIT 1))
        INTO v_bank FROM public.accounts_payable ap WHERE ap.id = NEW.account_payable_id;
      INSERT INTO public.cash_transactions (
        transaction_date, description, transaction_type, category,
        amount, payment_method, bank_account_id, cost_center_id,
        account_id, document_number, notes, reference_type, reference_id)
      SELECT NEW.payment_date,
        COALESCE('Pagamento - ' || s.company_name || ' - ' || ap.description, 'Pagamento de conta a pagar'),
        'Saída','Pagamentos', NEW.amount, NEW.payment_method, v_bank,
        ap.cost_center_id, ap.account_id, ap.document_number,
        COALESCE(NEW.notes,''), 'manual', NEW.id
      FROM public.accounts_payable ap
      LEFT JOIN public.suppliers s ON s.id = ap.supplier_id
      WHERE ap.id = NEW.account_payable_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_transactions
       SET transaction_date=NEW.payment_date, amount=NEW.amount, payment_method=NEW.payment_method,
           bank_account_id=COALESCE(NEW.bank_account_id, bank_account_id),
           notes=COALESCE(NEW.notes, notes), updated_at=now()
     WHERE reference_type='manual' AND reference_id=NEW.id;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.insert_cash_on_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_bank uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cash_transactions
                 WHERE reference_type='manual' AND reference_id=NEW.id) THEN
    SELECT COALESCE(NEW.bank_account_id, ar.bank_account_id,
                    (SELECT id FROM public.bank_accounts WHERE is_default AND is_active LIMIT 1))
      INTO v_bank FROM public.accounts_receivable ar WHERE ar.id = NEW.account_receivable_id;
    INSERT INTO public.cash_transactions (
      transaction_date, description, transaction_type, category,
      amount, payment_method, bank_account_id, cost_center_id,
      account_id, document_number, notes, reference_type, reference_id)
    SELECT NEW.receipt_date,
      COALESCE('Recebimento - ' || c.name || ' - ' || ar.description, 'Recebimento de conta a receber'),
      'Entrada','Recebimentos', NEW.amount, NEW.receipt_method, v_bank,
      ar.cost_center_id, ar.account_id, ar.document_number,
      COALESCE(NEW.notes,''), 'manual', NEW.id
    FROM public.accounts_receivable ar
    LEFT JOIN public.clients c ON c.id = ar.client_id
    WHERE ar.id = NEW.account_receivable_id;
  END IF;
  RETURN NEW;
END; $function$;

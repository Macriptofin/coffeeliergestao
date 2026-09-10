-- accounts_payable.payment_date ficava NULL em contas baixadas por payment_transactions (159 casos em 2026, achado da auditoria de 05/09/2026).
-- Raiz: o trigger que recalcula paid/remaining/status não carimbava a data. Passa a carimbar (sem sobrescrever data já informada) e limpa quando a conta volta a ficar em aberto.
CREATE OR REPLACE FUNCTION public.update_payable_remaining_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_paid numeric; v_last date;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.account_payable_id ELSE NEW.account_payable_id END;
  SELECT COALESCE(SUM(amount), 0), MAX(payment_date) INTO v_paid, v_last
  FROM public.payment_transactions WHERE account_payable_id = v_id;

  UPDATE public.accounts_payable
  SET
    paid_amount = v_paid,
    remaining_amount = original_amount + interest_amount - discount_amount - v_paid,
    status = CASE
      WHEN (original_amount + interest_amount - discount_amount - v_paid) <= 0 THEN 'Pago'
      WHEN due_date < CURRENT_DATE AND (original_amount + interest_amount - discount_amount - v_paid) > 0 THEN 'Vencido'
      ELSE 'Pendente'
    END,
    payment_date = CASE
      WHEN (original_amount + interest_amount - discount_amount - v_paid) <= 0 THEN COALESCE(payment_date, v_last)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Backfill: contas pagas sem data recebem a data do último pagamento registrado
UPDATE public.accounts_payable ap
SET payment_date = pt.last_pay
FROM (SELECT account_payable_id, MAX(payment_date) AS last_pay FROM public.payment_transactions GROUP BY account_payable_id) pt
WHERE pt.account_payable_id = ap.id AND ap.status = 'Pago' AND ap.payment_date IS NULL;

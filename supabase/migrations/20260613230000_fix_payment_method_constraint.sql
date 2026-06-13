-- Fix: payment_transactions.payment_method CHECK constraint rejeitava
-- os valores enviados pelo frontend ('Cartão de Débito', 'Cartão de Crédito',
-- 'Transferência Bancária', 'Depósito'), causando falha silenciosa no INSERT
-- de payment_transactions e consequentemente ausência no fluxo de caixa.

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_payment_method_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'Dinheiro',
    'PIX',
    'Transferência',
    'Transferência Bancária',
    'Cartão Débito',
    'Cartão de Débito',
    'Cartão Crédito',
    'Cartão de Crédito',
    'Boleto',
    'Cheque',
    'Depósito'
  ]));

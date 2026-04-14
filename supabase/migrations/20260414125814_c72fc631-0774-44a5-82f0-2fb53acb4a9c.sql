
-- Add new columns to receipt_transactions
ALTER TABLE public.receipt_transactions
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT;

-- Drop old check constraint if exists and recreate with correct values
DO $$
BEGIN
  -- Try to drop existing constraint
  BEGIN
    ALTER TABLE public.receipt_transactions DROP CONSTRAINT IF EXISTS receipt_transactions_receipt_method_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Add corrected check constraint for receipt_method
ALTER TABLE public.receipt_transactions
  ADD CONSTRAINT receipt_transactions_receipt_method_check
  CHECK (receipt_method IN ('Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Boleto', 'Cheque'));

-- Add check constraint for adjustment_type
ALTER TABLE public.receipt_transactions
  ADD CONSTRAINT receipt_transactions_adjustment_type_check
  CHECK (adjustment_type IS NULL OR adjustment_type IN (
    'Desconto de Antecipação',
    'Multa por Atraso',
    'Juros por Atraso', 
    'Desconto Comercial',
    'Taxa Bancária',
    'Outros'
  ));

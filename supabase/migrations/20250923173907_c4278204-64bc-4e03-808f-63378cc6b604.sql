-- Remover notas fiscais duplicadas, mantendo apenas a mais recente de cada número
WITH duplicates AS (
  SELECT id, invoice_number, 
         ROW_NUMBER() OVER (PARTITION BY invoice_number ORDER BY created_at DESC) as rn
  FROM public.purchase_invoices
)
DELETE FROM public.purchase_invoices 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
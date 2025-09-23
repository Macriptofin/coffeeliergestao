-- Adicionar constraint única para número da nota fiscal
ALTER TABLE public.purchase_invoices 
ADD CONSTRAINT unique_invoice_number UNIQUE (invoice_number);

-- Criar índice para melhorar performance na busca por número da nota
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_number ON public.purchase_invoices(invoice_number);
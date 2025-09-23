-- Adicionar campo para controlar se a nota fiscal foi lançada no estoque
ALTER TABLE public.purchase_invoices 
ADD COLUMN stock_posted BOOLEAN NOT NULL DEFAULT FALSE;

-- Adicionar campo para data/hora do lançamento no estoque
ALTER TABLE public.purchase_invoices 
ADD COLUMN stock_posted_at TIMESTAMP WITH TIME ZONE NULL;

-- Índice para consultas por status de lançamento
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_stock_posted 
ON public.purchase_invoices(stock_posted);
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

-- Corrigir a estrutura da tabela invoice_items
-- O campo supplier_product_id deveria ser ingredient_id para ingredientes
ALTER TABLE public.invoice_items 
DROP CONSTRAINT IF EXISTS invoice_items_supplier_product_id_fkey;

ALTER TABLE public.invoice_items 
RENAME COLUMN supplier_product_id TO ingredient_id;

-- Adicionar foreign key correta para ingredients
ALTER TABLE public.invoice_items 
ADD CONSTRAINT invoice_items_ingredient_id_fkey 
FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);

-- Agora adicionar a constraint única para números de nota fiscal
ALTER TABLE public.purchase_invoices 
ADD CONSTRAINT unique_invoice_number UNIQUE (invoice_number);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_number 
ON public.purchase_invoices(invoice_number);
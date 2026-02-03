-- Adicionar colunas para armazenar fator de conversão customizado em invoice_items
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS conversion_factor numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS converted_quantity numeric,
ADD COLUMN IF NOT EXISTS converted_unit_price numeric,
ADD COLUMN IF NOT EXISTS unit varchar(20) DEFAULT 'un',
ADD COLUMN IF NOT EXISTS description text;

-- Comentários para documentar o propósito
COMMENT ON COLUMN invoice_items.conversion_factor IS 'Fator de conversão ajustado pelo usuário no momento do lançamento da NF';
COMMENT ON COLUMN invoice_items.converted_quantity IS 'Quantidade convertida para unidade de uso (quantity * conversion_factor)';
COMMENT ON COLUMN invoice_items.converted_unit_price IS 'Preço unitário convertido para unidade de uso';
COMMENT ON COLUMN invoice_items.unit IS 'Unidade de compra do item na nota fiscal';
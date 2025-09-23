-- Adicionar coluna category na tabela products
ALTER TABLE public.products 
ADD COLUMN category TEXT DEFAULT 'Salgados';

-- Criar índice para melhor performance
CREATE INDEX idx_products_category ON public.products(category);
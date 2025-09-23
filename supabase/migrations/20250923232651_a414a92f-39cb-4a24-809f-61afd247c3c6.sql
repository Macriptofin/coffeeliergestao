-- Adicionar colunas necessárias à tabela proposals
ALTER TABLE public.proposals 
ADD COLUMN event_category TEXT,
ADD COLUMN products_selected BOOLEAN DEFAULT FALSE;

-- Criar índices para melhor performance
CREATE INDEX idx_proposals_event_category ON public.proposals(event_category);
CREATE INDEX idx_proposals_products_selected ON public.proposals(products_selected);
-- Liga a resposta de cada fornecedor ao item pedido originalmente, permitindo
-- montar o comparativo (linha = item pedido, coluna = fornecedor). Nullable por
-- design: um fornecedor pode cotar algo fora da lista (Fase 2), mas a Fase 1 não
-- constrói UI para esse caso (usar brand/specifications para registrar substituto).
ALTER TABLE public.supplier_quote_items
  ADD COLUMN quote_request_item_id UUID NULL REFERENCES public.quote_request_items(id);

CREATE INDEX idx_supplier_quote_items_request_item ON public.supplier_quote_items(quote_request_item_id);

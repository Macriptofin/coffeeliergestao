-- Lista mestra do que estamos pedindo pra cotar (o pedido original), independente
-- da resposta de qualquer fornecedor específico. supplier_quote_items (por
-- fornecedor) referencia esta tabela para permitir o comparativo item×fornecedor.
-- É também exatamente o que um fornecedor logado veria na Fase 2 (self-service).
CREATE TABLE public.quote_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage quote_request_items"
ON public.quote_request_items FOR ALL
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX idx_quote_request_items_quote_request ON public.quote_request_items(quote_request_id);

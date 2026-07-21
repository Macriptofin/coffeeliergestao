-- A migration de 29/set/2025 usava CREATE TABLE IF NOT EXISTS purchase_orders,
-- mas a tabela já existia desde 23/set com um shape mais antigo — a criação foi
-- um no-op silencioso e as colunas de negócio (vínculo com cotação, aprovação
-- etc.) nunca existiram de fato. Adicionando agora, e trocando o CHECK de
-- status pra um vocabulário PT-BR completo (tabela vazia, sem risco de backfill).
ALTER TABLE public.purchase_orders
  ADD COLUMN quote_request_id UUID REFERENCES public.quote_requests(id),
  ADD COLUMN supplier_quote_id UUID REFERENCES public.supplier_quotes(id),
  ADD COLUMN payment_terms TEXT,
  ADD COLUMN payment_method TEXT,
  ADD COLUMN approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('Pendente', 'Aprovado', 'Enviado', 'Recebido', 'Cancelado'));

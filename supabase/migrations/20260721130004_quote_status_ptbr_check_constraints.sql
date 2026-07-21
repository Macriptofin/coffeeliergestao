-- Vocabulário de status em PT-BR (convenção do projeto) + CHECK constraint.
-- Tabelas vazias (schema nunca usado por UI) — zero risco de migrar dados.

ALTER TABLE public.quote_requests
  ALTER COLUMN status SET DEFAULT 'Coletando Cotações';
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (status IN ('Coletando Cotações', 'Concluída', 'Cancelada'));

ALTER TABLE public.supplier_quotes
  ALTER COLUMN status SET DEFAULT 'Recebida';
ALTER TABLE public.supplier_quotes
  ADD CONSTRAINT supplier_quotes_status_check
  CHECK (status IN ('Recebida', 'Selecionada', 'Rejeitada'));

-- quote_request_suppliers.response_status fica como está (default 'pending', em
-- inglês) — não é escrita ativamente na Fase 1 (pressupõe fluxo de envio/resposta
-- que só existe na Fase 2). Revisar vocabulário quando essa fase for implementada.

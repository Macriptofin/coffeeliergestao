-- Fix: accounts_payable estava sem a coluna document_type,
-- causando erro "Erro ao cadastrar conta a pagar" ao lançar
-- despesas do tipo Recibo, Comprovante ou Sem Documento.

ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS document_type text
  CHECK (document_type IS NULL OR document_type = ANY (ARRAY[
    'nota_fiscal', 'recibo', 'comprovante', 'sem_documento'
  ]));

COMMENT ON COLUMN public.accounts_payable.document_type IS
  'Tipo do documento: nota_fiscal, recibo, comprovante, sem_documento';

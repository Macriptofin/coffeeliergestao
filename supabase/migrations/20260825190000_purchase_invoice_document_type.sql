-- Compra sem nota fiscal (25/ago/2026) — caso real: mercado que só emite
-- recibo/comprovante, sem numeração. A compra PRECISA passar pelo fluxo de
-- Notas Fiscais (é ele que movimenta estoque e custo médio), mas inventar
-- número na mão arrisca colidir com NF real (invoice_number é UNIQUE global)
-- e confunde o que é documento fiscal com o que não é.
--
-- Espelha o vocabulário que Contas a Pagar já usa desde jun/2026
-- (accounts_payable.document_type): nota_fiscal | recibo | comprovante.
-- Quando o documento não é NF e o número vem vazio, o trigger gera uma
-- numeração interna REC-AAAA-NNNN (mesmo padrão do COT- das cotações) —
-- autoexplicativa: ninguém confunde com nota fiscal de verdade.

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'nota_fiscal'
    CHECK (document_type IN ('nota_fiscal', 'recibo', 'comprovante'));

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_number integer;
BEGIN
  -- Só gera para documento não-fiscal com número vazio; número digitado
  -- (ex.: nº do cupom/comprovante) é respeitado.
  IF NEW.document_type IS DISTINCT FROM 'nota_fiscal'
     AND (NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '') THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)), 0) + 1
      INTO next_number
      FROM public.purchase_invoices
     WHERE invoice_number LIKE 'REC-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-%';

    NEW.invoice_number := 'REC-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(next_number::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generate_receipt_number ON public.purchase_invoices;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT OR UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

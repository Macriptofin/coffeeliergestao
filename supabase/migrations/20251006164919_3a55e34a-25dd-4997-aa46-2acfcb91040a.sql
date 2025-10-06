-- Tabela para armazenar histórico de matches de materiais
-- Permite aprendizado do sistema baseado em escolhas anteriores
CREATE TABLE IF NOT EXISTS public.invoice_material_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_item_name TEXT NOT NULL,
  invoice_item_name_normalized TEXT NOT NULL,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  match_count INTEGER NOT NULL DEFAULT 1,
  last_matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(invoice_item_name_normalized, material_id, supplier_id)
);

-- Índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_invoice_material_matches_name ON public.invoice_material_matches(invoice_item_name_normalized);
CREATE INDEX IF NOT EXISTS idx_invoice_material_matches_material ON public.invoice_material_matches(material_id);
CREATE INDEX IF NOT EXISTS idx_invoice_material_matches_supplier ON public.invoice_material_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoice_material_matches_count ON public.invoice_material_matches(match_count DESC);

-- Tabela para armazenar histórico de matches de fornecedores
CREATE TABLE IF NOT EXISTS public.invoice_supplier_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_supplier_text TEXT NOT NULL,
  invoice_supplier_text_normalized TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  match_count INTEGER NOT NULL DEFAULT 1,
  last_matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(invoice_supplier_text_normalized, supplier_id)
);

-- Índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_invoice_supplier_matches_text ON public.invoice_supplier_matches(invoice_supplier_text_normalized);
CREATE INDEX IF NOT EXISTS idx_invoice_supplier_matches_supplier ON public.invoice_supplier_matches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoice_supplier_matches_count ON public.invoice_supplier_matches(match_count DESC);

-- Função para normalizar texto (remover acentos, espaços extras, etc)
CREATE OR REPLACE FUNCTION public.normalize_text(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(trim(regexp_replace(
    translate(
      text_input,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
    ),
    '\s+', ' ', 'g'
  )));
END;
$$;

-- RLS Policies
ALTER TABLE public.invoice_material_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_supplier_matches ENABLE ROW LEVEL SECURITY;

-- Policies para invoice_material_matches
CREATE POLICY "Users can view invoice material matches"
ON public.invoice_material_matches
FOR SELECT
USING (true);

CREATE POLICY "Users can insert invoice material matches"
ON public.invoice_material_matches
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update invoice material matches"
ON public.invoice_material_matches
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policies para invoice_supplier_matches
CREATE POLICY "Users can view invoice supplier matches"
ON public.invoice_supplier_matches
FOR SELECT
USING (true);

CREATE POLICY "Users can insert invoice supplier matches"
ON public.invoice_supplier_matches
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update invoice supplier matches"
ON public.invoice_supplier_matches
FOR UPDATE
USING (auth.uid() IS NOT NULL);
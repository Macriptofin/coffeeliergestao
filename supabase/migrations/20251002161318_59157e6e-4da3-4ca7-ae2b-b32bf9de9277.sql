-- ============================================
-- SISTEMA DE LANÇAMENTO AUTOMATIZADO DE NOTAS FISCAIS
-- Tabelas e funções para OCR, matching e aprendizado
-- ============================================

-- Habilitar extensão para similaridade de texto (fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- TABELA: invoice_ocr_sessions
-- Armazena cada sessão de upload/processamento de nota fiscal
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_ocr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Imagem
  image_url TEXT NOT NULL,
  image_size_bytes INTEGER,
  
  -- OCR
  ocr_provider TEXT NOT NULL DEFAULT 'openai-gpt5',
  ocr_raw_text TEXT,
  ocr_confidence DECIMAL,
  ocr_processing_time_ms INTEGER,
  
  -- Dados extraídos (JSON estruturado do GPT)
  extracted_data JSONB,
  extraction_status TEXT DEFAULT 'pending',
  extraction_error TEXT,
  
  -- Status geral
  status TEXT DEFAULT 'draft',
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_ocr_sessions_status ON public.invoice_ocr_sessions(status);
CREATE INDEX idx_invoice_ocr_sessions_created_by ON public.invoice_ocr_sessions(created_by);
CREATE INDEX idx_invoice_ocr_sessions_created_at ON public.invoice_ocr_sessions(created_at DESC);

-- RLS para invoice_ocr_sessions
ALTER TABLE public.invoice_ocr_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own OCR sessions"
  ON public.invoice_ocr_sessions FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own OCR sessions"
  ON public.invoice_ocr_sessions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own OCR sessions"
  ON public.invoice_ocr_sessions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all OCR sessions"
  ON public.invoice_ocr_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- TABELA: invoice_ocr_items
-- Armazena cada item extraído de uma nota fiscal
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_ocr_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.invoice_ocr_sessions(id) ON DELETE CASCADE,
  
  -- Dados extraídos da nota
  item_description TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit TEXT,
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL NOT NULL,
  
  -- Matching com materiais
  suggested_material_id UUID REFERENCES public.materials(id),
  matched_material_id UUID REFERENCES public.materials(id),
  match_confidence DECIMAL,
  match_method TEXT,
  
  -- Status do item
  status TEXT DEFAULT 'pending',
  
  -- Conversão de unidades
  conversion_factor DECIMAL,
  converted_quantity DECIMAL,
  converted_unit_price DECIMAL,
  
  -- Lançamento no estoque
  stock_movement_id UUID REFERENCES public.stock_movements(id),
  launched_at TIMESTAMPTZ,
  launch_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_ocr_items_session ON public.invoice_ocr_items(session_id);
CREATE INDEX idx_invoice_ocr_items_status ON public.invoice_ocr_items(status);
CREATE INDEX idx_invoice_ocr_items_matched_material ON public.invoice_ocr_items(matched_material_id);
CREATE INDEX idx_invoice_ocr_items_suggested_material ON public.invoice_ocr_items(suggested_material_id);

-- RLS para invoice_ocr_items
ALTER TABLE public.invoice_ocr_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items from their sessions"
  ON public.invoice_ocr_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice_ocr_sessions 
      WHERE id = invoice_ocr_items.session_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create items in their sessions"
  ON public.invoice_ocr_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoice_ocr_sessions 
      WHERE id = invoice_ocr_items.session_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their sessions"
  ON public.invoice_ocr_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice_ocr_sessions 
      WHERE id = invoice_ocr_items.session_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can view all OCR items"
  ON public.invoice_ocr_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- TABELA: material_name_mappings
-- Sistema de aprendizado
-- ============================================
CREATE TABLE IF NOT EXISTS public.material_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  invoice_description TEXT NOT NULL,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  
  supplier_name TEXT,
  times_used INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(invoice_description, material_id)
);

CREATE INDEX idx_material_mappings_description ON public.material_name_mappings 
  USING gin(to_tsvector('portuguese', invoice_description));
CREATE INDEX idx_material_mappings_material ON public.material_name_mappings(material_id);
CREATE INDEX idx_material_mappings_times_used ON public.material_name_mappings(times_used DESC);

-- RLS para material_name_mappings
ALTER TABLE public.material_name_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view mappings"
  ON public.material_name_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create mappings"
  ON public.material_name_mappings FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System can update mappings"
  ON public.material_name_mappings FOR UPDATE
  USING (true);

-- ============================================
-- FUNÇÃO: suggest_material_matches
-- Versão corrigida com UNION ALL simples
-- ============================================
CREATE OR REPLACE FUNCTION public.suggest_material_matches(
  p_item_description TEXT,
  p_supplier_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  material_code TEXT,
  confidence DECIMAL,
  match_method TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- 1. Match aprendido (prioridade máxima)
    SELECT 
      m.id,
      m.name,
      m.code,
      1.0::DECIMAL as conf,
      'learned'::TEXT,
      format('Usado %s vezes', mnm.times_used)::TEXT,
      1 as prio
    FROM material_name_mappings mnm
    JOIN materials m ON m.id = mnm.material_id
    WHERE LOWER(TRIM(mnm.invoice_description)) = LOWER(TRIM(p_item_description))
      AND (p_supplier_name IS NULL OR LOWER(mnm.supplier_name) = LOWER(p_supplier_name))
      AND m.is_archived = false
    
    UNION ALL
    
    -- 2. Match exato de nome
    SELECT 
      m.id,
      m.name,
      m.code,
      0.95::DECIMAL,
      'exact'::TEXT,
      'Nome idêntico'::TEXT,
      2
    FROM materials m
    WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(p_item_description))
      AND m.is_archived = false
    
    UNION ALL
    
    -- 3. Fuzzy match
    SELECT 
      m.id,
      m.name,
      m.code,
      similarity(LOWER(m.name), LOWER(p_item_description))::DECIMAL,
      'fuzzy'::TEXT,
      format('%.0f%% similar', similarity(LOWER(m.name), LOWER(p_item_description)) * 100)::TEXT,
      3
    FROM materials m
    WHERE similarity(LOWER(m.name), LOWER(p_item_description)) > 0.3
      AND m.is_archived = false
    
    UNION ALL
    
    -- 4. Full text search
    SELECT 
      m.id,
      m.name,
      m.code,
      ts_rank(to_tsvector('portuguese', m.name), plainto_tsquery('portuguese', p_item_description))::DECIMAL,
      'fulltext'::TEXT,
      'Palavras-chave'::TEXT,
      4
    FROM materials m
    WHERE to_tsvector('portuguese', m.name) @@ plainto_tsquery('portuguese', p_item_description)
      AND m.is_archived = false
  ) matches
  ORDER BY prio, conf DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- FUNÇÃO: save_material_mapping
-- ============================================
CREATE OR REPLACE FUNCTION public.save_material_mapping(
  p_invoice_description TEXT,
  p_material_id UUID,
  p_supplier_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.material_name_mappings (
    invoice_description,
    material_id,
    supplier_name,
    times_used,
    last_used_at,
    created_by
  )
  VALUES (
    p_invoice_description,
    p_material_id,
    p_supplier_name,
    1,
    now(),
    auth.uid()
  )
  ON CONFLICT (invoice_description, material_id) 
  DO UPDATE SET
    times_used = material_name_mappings.times_used + 1,
    last_used_at = now(),
    supplier_name = COALESCE(p_supplier_name, material_name_mappings.supplier_name);
END;
$$;

-- ============================================
-- TRIGGER: Atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_invoice_ocr_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_invoice_ocr_sessions_updated_at
  BEFORE UPDATE ON public.invoice_ocr_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_ocr_updated_at();

CREATE TRIGGER update_invoice_ocr_items_updated_at
  BEFORE UPDATE ON public.invoice_ocr_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_invoice_ocr_updated_at();
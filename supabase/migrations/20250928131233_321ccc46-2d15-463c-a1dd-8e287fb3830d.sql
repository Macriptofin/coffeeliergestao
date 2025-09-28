-- Centro de Configurações Unificado + Taxonomias Genéricas
-- 1. Namespaces de configuração
CREATE TABLE public.config_namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Catálogo de opções configuráveis (metadados)
CREATE TABLE public.config_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL REFERENCES public.config_namespaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'array')),
  default_value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(namespace_id, key)
);

-- 3. Valores efetivos (escopo organização)
CREATE TABLE public.config_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL REFERENCES public.config_namespaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_jsonb JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(namespace_id, key)
);

-- 4. Definições de taxonomias (listas mestras)
CREATE TABLE public.taxonomy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Termos de taxonomia (suporta hierarquia)
CREATE TABLE public.taxonomy_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id UUID NOT NULL REFERENCES public.taxonomy_definitions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.taxonomy_terms(id),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Auditoria
CREATE TABLE public.ops_config_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Integração com materiais (compatível)
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS category_term_id UUID REFERENCES public.taxonomy_terms(id),
ADD COLUMN IF NOT EXISTS subcategory_term_id UUID REFERENCES public.taxonomy_terms(id);

-- 8. View enriquecida para materiais
CREATE OR REPLACE VIEW public.v_materials_enriched AS
SELECT
  m.*,
  COALESCE(tc.name, m.category) as category_name_resolved,
  COALESCE(ts.name, m.subcategory) as subcategory_name_resolved,
  tc.code as category_code,
  ts.code as subcategory_code
FROM public.materials m
LEFT JOIN public.taxonomy_terms tc ON tc.id = m.category_term_id
LEFT JOIN public.taxonomy_terms ts ON ts.id = m.subcategory_term_id;

-- 9. Função utilitária para buscar configurações
CREATE OR REPLACE FUNCTION public.get_config(p_namespace TEXT, p_key TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    cv.value_jsonb,
    co.default_value,
    'null'::jsonb
  )
  FROM config_namespaces cn
  LEFT JOIN config_options co ON co.namespace_id = cn.id AND co.key = p_key
  LEFT JOIN config_values cv ON cv.namespace_id = cn.id AND cv.key = p_key
  WHERE cn.key = p_namespace;
$$;

-- 10. Função para auditoria automática
CREATE OR REPLACE FUNCTION public.audit_config_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, after)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, before, after)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, before)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 11. Triggers de auditoria
CREATE TRIGGER config_values_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON config_values
  FOR EACH ROW EXECUTE FUNCTION audit_config_changes();

CREATE TRIGGER taxonomy_terms_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON taxonomy_terms
  FOR EACH ROW EXECUTE FUNCTION audit_config_changes();

-- 12. Índices para performance
CREATE INDEX idx_config_values_namespace_key ON config_values(namespace_id, key);
CREATE INDEX idx_taxonomy_terms_taxonomy_parent ON taxonomy_terms(taxonomy_id, parent_id);
CREATE INDEX idx_taxonomy_terms_active ON taxonomy_terms(is_active) WHERE is_active = true;
CREATE INDEX idx_materials_category_term ON materials(category_term_id) WHERE category_term_id IS NOT NULL;
CREATE INDEX idx_materials_subcategory_term ON materials(subcategory_term_id) WHERE subcategory_term_id IS NOT NULL;

-- 13. RLS Policies
ALTER TABLE public.config_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_config_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (todos autenticados)
CREATE POLICY "Anyone authenticated can view config_namespaces" ON config_namespaces
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can view config_options" ON config_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can view config_values" ON config_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can view taxonomy_definitions" ON taxonomy_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can view taxonomy_terms" ON taxonomy_terms
  FOR SELECT TO authenticated USING (true);

-- Políticas de escrita (apenas admins)
CREATE POLICY "Only admins can manage config_namespaces" ON config_namespaces
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage config_options" ON config_options
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage config_values" ON config_values
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage taxonomy_definitions" ON taxonomy_definitions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage taxonomy_terms" ON taxonomy_terms
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas de auditoria (admins podem ver, sistema pode inserir)
CREATE POLICY "Admins can view config audit log" ON ops_config_audit_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert config audit log" ON ops_config_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 14. Seeds iniciais
INSERT INTO public.config_namespaces (key, label) VALUES
  ('gerais', 'Configurações Gerais'),
  ('estoque', 'Estoque & Materiais'),
  ('producao', 'Produção'),
  ('vendas', 'Vendas & Propostas'),
  ('financeiro', 'Financeiro'),
  ('eventos', 'Eventos & Agenda'),
  ('rh', 'Recursos Humanos');

-- Seeds de taxonomias
INSERT INTO public.taxonomy_definitions (key, label, module_key) VALUES
  ('material_category', 'Categorias de Material', 'estoque'),
  ('material_subcategory', 'Subcategorias de Material', 'estoque'),
  ('product_category', 'Categorias de Produto', 'vendas'),
  ('event_type', 'Tipos de Evento', 'eventos');

-- Seeds de categorias de materiais
INSERT INTO public.taxonomy_terms (taxonomy_id, code, name, sort_order)
SELECT 
  td.id,
  t.code,
  t.name,
  t.sort_order
FROM taxonomy_definitions td,
(VALUES
  ('INS', 'Insumo', 1),
  ('EMB', 'Embalagem', 2),
  ('INT', 'Produto Intermediário', 3),
  ('FIN', 'Produto Acabado', 4),
  ('COM', 'Produto Composto', 5),
  ('REV', 'Produto de Revenda', 6)
) t(code, name, sort_order)
WHERE td.key = 'material_category';

-- Seeds de subcategorias de materiais
INSERT INTO public.taxonomy_terms (taxonomy_id, parent_id, name, sort_order)
SELECT 
  td.id,
  tc.id,
  t.name,
  t.sort_order
FROM taxonomy_definitions td
CROSS JOIN (VALUES
  ('Insumo', 'Condimentos & Temperos', 1),
  ('Insumo', 'Hortifruti', 2),
  ('Insumo', 'Grãos & Cereais', 3),
  ('Insumo', 'Laticínios', 4),
  ('Insumo', 'Proteínas', 5),
  ('Insumo', 'Óleos & Gorduras', 6),
  ('Embalagem', 'Embalagens Primárias', 7),
  ('Embalagem', 'Embalagens Secundárias', 8),
  ('Embalagem', 'Etiquetas & Rótulos', 9)
) t(category_name, name, sort_order)
JOIN taxonomy_terms tc ON tc.name = t.category_name
WHERE td.key = 'material_subcategory';

-- Seeds de configurações de exemplo (com casting correto para JSONB)
INSERT INTO public.config_options (namespace_id, key, value_type, default_value, description)
SELECT 
  cn.id,
  t.key,
  t.value_type,
  t.default_value::jsonb,
  t.description
FROM config_namespaces cn,
(VALUES
  ('estoque', 'unidade_padrao', 'string', '"unidade"', 'Unidade de medida padrão para novos materiais'),
  ('estoque', 'cores_categoria', 'json', '{"Insumo": "#7C8C65", "Embalagem": "#8B7355", "Produto Acabado": "#6B73A0", "Produto Intermediário": "#A0826B", "Produto Composto": "#8A6BA0", "Produto de Revenda": "#6BA08A"}', 'Mapa de cores por categoria de material'),
  ('producao', 'margem_seguranca_default', 'number', '0.1', 'Margem de segurança padrão para cálculos de produção (10%)'),
  ('vendas', 'markup_default', 'number', '2.5', 'Markup padrão para cálculo de preços'),
  ('eventos', 'antecedencia_minima_dias', 'number', '7', 'Antecedência mínima para agendamento de eventos (dias)'),
  ('gerais', 'empresa_nome', 'string', '"Coffeelier"', 'Nome da empresa'),
  ('gerais', 'moeda_simbolo', 'string', '"R$"', 'Símbolo da moeda'),
  ('financeiro', 'conta_caixa_default', 'string', '"Caixa Geral"', 'Conta de caixa padrão')
) t(namespace_key, key, value_type, default_value, description)
WHERE cn.key = t.namespace_key;
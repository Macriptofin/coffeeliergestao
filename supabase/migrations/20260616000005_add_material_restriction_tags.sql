-- Dimensão transversal de restrições/características (Low Fat, Vegano, Sem Glúten...).
-- Tags many-to-many: um produto pode ter várias. Eixo independente de categoria/tipo.

-- 1) Nova definição de taxonomia + termos iniciais
WITH def AS (
  INSERT INTO taxonomy_definitions (key, label, module_key)
  VALUES ('material_restriction', 'Restrições & Características', 'estoque')
  RETURNING id
)
INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT def.id, NULL, v.code, v.name, v.ord, true
FROM def, (VALUES
  ('REST_LOWFAT','Low Fat / Fitness',1),
  ('REST_VEGANO','Vegano',2),
  ('REST_VEGETARIANO','Vegetariano',3),
  ('REST_SEMGLUTEN','Sem Glúten',4),
  ('REST_SEMLACTOSE','Sem Lactose',5),
  ('REST_ZEROACUCAR','Zero Açúcar',6),
  ('REST_LOWCARB','Low Carb',7)
) AS v(code,name,ord);

-- 2) Tabela de ligação material <-> tag (many-to-many)
CREATE TABLE IF NOT EXISTS material_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, term_id)
);

ALTER TABLE material_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_tags_select_authenticated" ON material_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "material_tags_manage_admin_manager" ON material_tags
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_material_tags_material ON material_tags(material_id);
CREATE INDEX IF NOT EXISTS idx_material_tags_term ON material_tags(term_id);

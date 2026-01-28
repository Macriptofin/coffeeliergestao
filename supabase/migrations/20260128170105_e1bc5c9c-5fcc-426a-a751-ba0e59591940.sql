-- 1. Criar a definição de taxonomia para Tipos de Material
INSERT INTO taxonomy_definitions (id, key, label, module_key)
VALUES ('f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', 'material_type', 'Tipos de Material', 'estoque')
ON CONFLICT (key) DO NOTHING;

-- 2. Criar os termos de tipos de produto padrão
INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', NULL, 'TIPO_INS', 'Insumo', 1, true
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_terms WHERE code = 'TIPO_INS');

INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', NULL, 'TIPO_EMB', 'Embalagem', 2, true
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_terms WHERE code = 'TIPO_EMB');

INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', NULL, 'TIPO_INT', 'Produto Intermediário', 3, true
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_terms WHERE code = 'TIPO_INT');

INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', NULL, 'TIPO_FIN', 'Produto Acabado', 4, true
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_terms WHERE code = 'TIPO_FIN');

INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active)
SELECT 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', NULL, 'TIPO_COM', 'Produto Composto', 5, true
WHERE NOT EXISTS (SELECT 1 FROM taxonomy_terms WHERE code = 'TIPO_COM');

-- 3. Adicionar coluna type_term_id na tabela materials
ALTER TABLE materials ADD COLUMN IF NOT EXISTS type_term_id UUID REFERENCES taxonomy_terms(id);

-- 4. Atualizar materials existentes para vincular ao tipo de produto
UPDATE materials m SET type_term_id = t.id 
FROM taxonomy_terms t 
WHERE t.code = 'TIPO_INS' AND m.material_type = 'ingredient' AND m.type_term_id IS NULL;

UPDATE materials m SET type_term_id = t.id 
FROM taxonomy_terms t 
WHERE t.code = 'TIPO_EMB' AND m.material_type = 'packaging' AND m.type_term_id IS NULL;

UPDATE materials m SET type_term_id = t.id 
FROM taxonomy_terms t 
WHERE t.code = 'TIPO_INT' AND m.material_type = 'intermediate_product' AND m.type_term_id IS NULL;

UPDATE materials m SET type_term_id = t.id 
FROM taxonomy_terms t 
WHERE t.code = 'TIPO_FIN' AND m.material_type = 'finished_product' AND m.type_term_id IS NULL;

UPDATE materials m SET type_term_id = t.id 
FROM taxonomy_terms t 
WHERE t.code = 'TIPO_COM' AND m.material_type = 'composite_product' AND m.type_term_id IS NULL;
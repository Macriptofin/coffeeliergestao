-- =====================================================
-- MIGRAÇÃO: Nova Taxonomia Comercial de Materiais
-- Objetivo: Adicionar categorias comerciais (sem deletar antigas)
-- =====================================================

-- 1. Garantir que as definições de taxonomia existem
INSERT INTO taxonomy_definitions (key, label, module_key) 
VALUES ('material_category', 'Categorias de Material', 'materials')
ON CONFLICT (key) DO NOTHING;

INSERT INTO taxonomy_definitions (key, label, module_key) 
VALUES ('material_subcategory', 'Subcategorias de Material', 'materials')
ON CONFLICT (key) DO NOTHING;

-- 2. Criar categorias comerciais (se não existem)

DO $$
DECLARE
  v_taxonomy_id uuid;
  v_category_id uuid;
BEGIN
  -- Get taxonomy_id for material_category
  SELECT id INTO v_taxonomy_id FROM taxonomy_definitions WHERE key = 'material_category';

  -- Alimentos & Ingredientes
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Alimentos & Ingredientes', 'ALI', 101, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Alimentos & Ingredientes';
  END IF;

  -- Subcategorias de Alimentos
  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Grãos & Cereais', 'ALI_GRA', 1),
    ('Laticínios', 'ALI_LAT', 2),
    ('Proteínas', 'ALI_PRO', 3),
    ('Hortifruti', 'ALI_HOR', 4),
    ('Óleos & Gorduras', 'ALI_OLE', 5),
    ('Condimentos & Temperos', 'ALI_CON', 6),
    ('Açúcares & Adoçantes', 'ALI_ACU', 7),
    ('Panificados', 'ALI_PAN', 8),
    ('Cacau & Chocolate', 'ALI_CAC', 9),
    ('Cafés & Chás', 'ALI_CAF', 10)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

  -- Bebidas
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Bebidas', 'BEB', 102, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Bebidas';
  END IF;

  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Refrigerantes', 'BEB_REF', 1),
    ('Sucos & Néctares', 'BEB_SUC', 2),
    ('Águas', 'BEB_AGU', 3),
    ('Bebidas Alcoólicas', 'BEB_ALC', 4),
    ('Energéticos', 'BEB_ENE', 5)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

  -- Doces & Confeitaria
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Doces & Confeitaria', 'DOC', 103, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Doces & Confeitaria';
  END IF;

  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Bolos & Tortas', 'DOC_BOL', 1),
    ('Doces Finos', 'DOC_FIN', 2),
    ('Sobremesas', 'DOC_SOB', 3),
    ('Massas & Bases', 'DOC_MAS', 4),
    ('Recheios & Coberturas', 'DOC_REC', 5),
    ('Caldas & Molhos', 'DOC_CAL', 6)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

  -- Salgados
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Salgados', 'SAL', 104, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Salgados';
  END IF;

  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Sanduíches', 'SAL_SAN', 1),
    ('Tortinhas & Quiches', 'SAL_TOR', 2),
    ('Salgados Fritos', 'SAL_FRI', 3),
    ('Salgados Assados', 'SAL_ASS', 4),
    ('Petiscos', 'SAL_PET', 5)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

  -- Kits & Mesas
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Kits & Mesas', 'KIT', 105, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Kits & Mesas';
  END IF;

  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Coffee Break', 'KIT_COF', 1),
    ('Coquetel', 'KIT_COQ', 2),
    ('Combos', 'KIT_COM', 3),
    ('Cestas', 'KIT_CES', 4)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

  -- Higiene & Limpeza (já existe, só garantir subcategorias)
  SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Higiene e Limpeza';
  
  IF v_category_id IS NOT NULL THEN
    INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
    SELECT 
      (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
      v_category_id,
      sub.name,
      sub.code,
      sub.sort_order,
      true
    FROM (VALUES
      ('Limpeza', 'HIG_LIM', 1),
      ('Higiene Pessoal', 'HIG_PES', 2),
      ('Sanitização', 'HIG_SAN', 3)
    ) AS sub(name, code, sort_order)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Equipamentos (já existe)
  SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Equipamentos';
  
  IF v_category_id IS NOT NULL THEN
    INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
    SELECT 
      (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
      v_category_id,
      sub.name,
      sub.code,
      sub.sort_order,
      true
    FROM (VALUES
      ('Cozinha', 'EQU_COZ', 1),
      ('Serviço', 'EQU_SER', 2),
      ('Refrigeração', 'EQU_REF', 3)
    ) AS sub(name, code, sort_order)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Operacionais
  INSERT INTO taxonomy_terms (taxonomy_id, name, code, sort_order, is_active)
  VALUES (v_taxonomy_id, 'Operacionais', 'OPE', 109, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;
  
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM taxonomy_terms WHERE taxonomy_id = v_taxonomy_id AND name = 'Operacionais';
  END IF;

  INSERT INTO taxonomy_terms (taxonomy_id, parent_id, name, code, sort_order, is_active)
  SELECT 
    (SELECT id FROM taxonomy_definitions WHERE key = 'material_subcategory'),
    v_category_id,
    sub.name,
    sub.code,
    sub.sort_order,
    true
  FROM (VALUES
    ('Utensílios', 'OPE_UTE', 1),
    ('Têxteis', 'OPE_TEX', 2),
    ('Infraestrutura', 'OPE_INF', 3),
    ('Exposição', 'OPE_EXP', 4)
  ) AS sub(name, code, sort_order)
  ON CONFLICT DO NOTHING;

END $$;
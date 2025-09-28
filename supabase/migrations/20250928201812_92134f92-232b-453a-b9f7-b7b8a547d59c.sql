-- Função para importar categorias e subcategorias do CSV
CREATE OR REPLACE FUNCTION import_taxonomy_from_csv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  category_record RECORD;
  subcategory_record RECORD;
  parent_category_id uuid;
  category_taxonomy_id uuid;
  subcategory_taxonomy_id uuid;
  imported_categories integer := 0;
  imported_subcategories integer := 0;
  result jsonb;
BEGIN
  -- Obter IDs das taxonomias
  SELECT id INTO category_taxonomy_id 
  FROM taxonomy_definitions 
  WHERE key = 'material_category';
  
  SELECT id INTO subcategory_taxonomy_id 
  FROM taxonomy_definitions 
  WHERE key = 'material_subcategory';
  
  -- Dados das categorias principais
  CREATE TEMP TABLE temp_categories (
    code text,
    name text,
    sort_order integer
  );
  
  INSERT INTO temp_categories VALUES
    ('INS', 'Insumo', 1),
    ('EMB', 'Embalagem', 2),
    ('INT', 'Produto Intermediário', 3),
    ('FIN', 'Produto Acabado', 4),
    ('COM', 'Produto Composto', 5),
    ('REV', 'Produto de Revenda', 6),
    ('HIG', 'Higiene e Limpeza', 7),
    ('EQU', 'Equipamentos', 8),
    ('UTE', 'Utensílios', 9),
    ('TEX', 'Têxteis & Apoios', 10),
    ('INF', 'Infraestrutura & Eventos', 11);
  
  -- Dados das subcategorias
  CREATE TEMP TABLE temp_subcategories (
    code text,
    name text,
    parent_name text,
    sort_order integer
  );
  
  INSERT INTO temp_subcategories VALUES
    ('INS_PAN', 'Panificados', 'Insumo', 1),
    ('INS_COND', 'Condimentos & Temperos', 'Insumo', 2),
    ('INS_HORT', 'Hortifruti', 'Insumo', 3),
    ('INS_GRAO', 'Grãos & Cereais', 'Insumo', 4),
    ('INS_LAT', 'Laticínios', 'Insumo', 5),
    ('INS_PROT', 'Proteínas', 'Insumo', 6),
    ('INS_OLEO', 'Óleos & Gorduras', 'Insumo', 7),
    ('INS_ACUC', 'Açúcares & Adoçantes', 'Insumo', 8),
    ('INS_CONS', 'Conservas & Enlatados', 'Insumo', 9),
    ('INS_LIQ', 'Líquidos Base (água, leite, xaropes)', 'Insumo', 10),
    ('EMB_PRI', 'Embalagens Primárias', 'Embalagem', 1),
    ('EMB_SEC', 'Embalagens Secundárias', 'Embalagem', 2),
    ('EMB_APR', 'Materiais de Apresentação (tags, rótulos)', 'Embalagem', 3),
    ('INT_MAS', 'Massas & Bases', 'Produto Intermediário', 1),
    ('INT_REC', 'Recheios & Coberturas', 'Produto Intermediário', 2),
    ('INT_CAL', 'Caldas & Molhos', 'Produto Intermediário', 3),
    ('INT_BEB', 'Bases de Bebidas (xaropes, concentrados)', 'Produto Intermediário', 4),
    ('FIN_SAL', 'Salgados (sanduíches, tortinhas, quiches)', 'Produto Acabado', 1),
    ('FIN_DOC', 'Doces (bolos, tortas, confeitaria)', 'Produto Acabado', 2),
    ('FIN_BEB', 'Bebidas (cafés, chás, sucos)', 'Produto Acabado', 3),
    ('FIN_PAO', 'Padaria (pães, brioches)', 'Produto Acabado', 4),
    ('FIN_OUT', 'Outros Acabados', 'Produto Acabado', 5),
    ('COM_KIT', 'Kits & Cestas', 'Produto Composto', 1),
    ('COM_MES_CB', 'Mesa Coffee Break', 'Produto Composto', 2),
    ('COM_MES_CQ', 'Mesa Coquetel', 'Produto Composto', 3),
    ('COM_COMBO', 'Combos/Ofertas', 'Produto Composto', 4),
    ('REV_BEB', 'Bebidas (refrigerantes, águas, sucos)', 'Produto de Revenda', 1),
    ('REV_SNACK', 'Snacks (salgadinhos, nuts, barras)', 'Produto de Revenda', 2),
    ('REV_DOC', 'Doces Industrializados', 'Produto de Revenda', 3),
    ('REV_OUT', 'Outros de Revenda', 'Produto de Revenda', 4),
    ('HIG_LIMP', 'Limpeza (detergente, desinfetante)', 'Higiene e Limpeza', 1),
    ('HIG_HIG', 'Higiene (álcool, papel, luvas)', 'Higiene e Limpeza', 2),
    ('EQU_COZ', 'Cozinha (fornos, batedeiras, freezers)', 'Equipamentos', 1),
    ('EQU_SERV', 'Serviço (garrafas térmicas, chaleiras)', 'Equipamentos', 2),
    ('UTE_PREP', 'Preparo (facas, colheres, fouet)', 'Utensílios', 1),
    ('UTE_SERV', 'Serviço (pegadores, conchas, travessas)', 'Utensílios', 2),
    ('TEX_AVT', 'Vestuário (aventais, toucas)', 'Têxteis & Apoios', 1),
    ('TEX_TOA', 'Toalhas & Apoios (toalhas, mantas)', 'Têxteis & Apoios', 2),
    ('INF_MOB', 'Móveis & Estruturas (mesas, estantes)', 'Infraestrutura & Eventos', 1),
    ('INF_UTIL', 'Utilidades Operacionais (caixas térmicas, carrinhos)', 'Infraestrutura & Eventos', 2),
    ('INF_DISP', 'Exposição/Displays (suportes, totens)', 'Infraestrutura & Eventos', 3);

  -- Importar categorias principais
  FOR category_record IN 
    SELECT * FROM temp_categories ORDER BY sort_order
  LOOP
    INSERT INTO taxonomy_terms (
      taxonomy_id, 
      code, 
      name, 
      sort_order, 
      is_active,
      parent_id
    ) VALUES (
      category_taxonomy_id,
      category_record.code,
      category_record.name,
      category_record.sort_order,
      true,
      null
    )
    ON CONFLICT (taxonomy_id, code) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;
    
    imported_categories := imported_categories + 1;
  END LOOP;

  -- Importar subcategorias
  FOR subcategory_record IN 
    SELECT * FROM temp_subcategories ORDER BY parent_name, sort_order
  LOOP
    -- Buscar ID da categoria pai
    SELECT id INTO parent_category_id
    FROM taxonomy_terms
    WHERE taxonomy_id = category_taxonomy_id 
      AND name = subcategory_record.parent_name;
    
    IF parent_category_id IS NOT NULL THEN
      INSERT INTO taxonomy_terms (
        taxonomy_id,
        code,
        name,
        parent_id,
        sort_order,
        is_active
      ) VALUES (
        subcategory_taxonomy_id,
        subcategory_record.code,
        subcategory_record.name,
        parent_category_id,
        subcategory_record.sort_order,
        true
      )
      ON CONFLICT (taxonomy_id, code) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        parent_id = EXCLUDED.parent_id,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active;
      
      imported_subcategories := imported_subcategories + 1;
    END IF;
  END LOOP;

  -- Limpar tabelas temporárias
  DROP TABLE temp_categories;
  DROP TABLE temp_subcategories;

  result := jsonb_build_object(
    'success', true,
    'imported_categories', imported_categories,
    'imported_subcategories', imported_subcategories,
    'message', 'Taxonomia importada com sucesso!'
  );

  RETURN result;
END;
$$;

-- Função para sugerir migração de materiais existentes
CREATE OR REPLACE FUNCTION suggest_material_taxonomy_migration()
RETURNS TABLE(
  material_id uuid,
  material_name text,
  current_category text,
  current_subcategory text,
  suggested_category_id uuid,
  suggested_category_name text,
  suggested_subcategory_id uuid,
  suggested_subcategory_name text,
  confidence_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH material_suggestions AS (
    SELECT 
      m.id as material_id,
      m.name as material_name,
      m.category as current_category,
      m.subcategory as current_subcategory,
      -- Lógica de mapeamento baseada nas categorias atuais
      CASE 
        WHEN m.category = 'Insumo' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Insumo'
        )
        WHEN m.category = 'Embalagem' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Embalagem'
        )
        WHEN m.category = 'Produto Acabado' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Produto Acabado'
        )
        WHEN m.category = 'Produto Composto' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Produto Composto'
        )
        WHEN m.category = 'Produto de Revenda' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Produto de Revenda'
        )
        WHEN m.category = 'Produto Intermediário' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Produto Intermediário'
        )
        ELSE (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_category' AND t.name = 'Insumo'
        )
      END as suggested_category_id,
      
      -- Mapeamento de subcategorias baseado no conteúdo atual
      CASE 
        WHEN m.subcategory ILIKE '%condimento%' OR m.subcategory ILIKE '%temper%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_COND'
        )
        WHEN m.subcategory ILIKE '%hortifruti%' OR m.subcategory ILIKE '%fruta%' OR m.subcategory ILIKE '%verdura%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_HORT'
        )
        WHEN m.subcategory ILIKE '%grao%' OR m.subcategory ILIKE '%cereal%' OR m.subcategory ILIKE '%panificado%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_GRAO'
        )
        WHEN m.subcategory ILIKE '%laticinio%' OR m.subcategory ILIKE '%leite%' OR m.subcategory ILIKE '%queijo%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_LAT'
        )
        WHEN m.subcategory ILIKE '%proteina%' OR m.subcategory ILIKE '%carne%' OR m.subcategory ILIKE '%peixe%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_PROT'
        )
        WHEN m.subcategory ILIKE '%oleo%' OR m.subcategory ILIKE '%gordura%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_OLEO'
        )
        WHEN m.subcategory ILIKE '%acucar%' OR m.subcategory ILIKE '%adocante%' OR m.subcategory ILIKE '%mel%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_ACUC'
        )
        WHEN m.subcategory ILIKE '%conserva%' OR m.subcategory ILIKE '%enlatado%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_CONS'
        )
        WHEN m.subcategory ILIKE '%bebida%' OR m.subcategory ILIKE '%liquido%' OR m.subcategory ILIKE '%agua%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'INS_LIQ'
        )
        WHEN m.subcategory ILIKE '%primaria%' OR m.subcategory ILIKE '%embalagens_primarias%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'EMB_PRI'
        )
        WHEN m.subcategory ILIKE '%secundaria%' OR m.subcategory ILIKE '%embalagens_secundarias%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'EMB_SEC'
        )
        WHEN m.subcategory ILIKE '%descartav%' THEN (
          SELECT t.id FROM taxonomy_terms t 
          JOIN taxonomy_definitions td ON t.taxonomy_id = td.id 
          WHERE td.key = 'material_subcategory' AND t.code = 'EMB_APR'
        )
        ELSE NULL
      END as suggested_subcategory_id,
      
      -- Score de confiança baseado na qualidade do match
      CASE 
        WHEN m.subcategory IS NOT NULL AND (
          m.subcategory ILIKE '%condimento%' OR 
          m.subcategory ILIKE '%hortifruti%' OR 
          m.subcategory ILIKE '%laticinio%' OR
          m.subcategory ILIKE '%primaria%' OR
          m.subcategory ILIKE '%secundaria%'
        ) THEN 90
        WHEN m.category IS NOT NULL THEN 70
        ELSE 50
      END as confidence_score
    FROM materials m
    WHERE m.category_term_id IS NULL OR m.subcategory_term_id IS NULL
  )
  SELECT 
    ms.material_id,
    ms.material_name,
    ms.current_category,
    ms.current_subcategory,
    ms.suggested_category_id,
    tc.name as suggested_category_name,
    ms.suggested_subcategory_id,
    ts.name as suggested_subcategory_name,
    ms.confidence_score
  FROM material_suggestions ms
  LEFT JOIN taxonomy_terms tc ON tc.id = ms.suggested_category_id
  LEFT JOIN taxonomy_terms ts ON ts.id = ms.suggested_subcategory_id
  ORDER BY ms.confidence_score DESC, ms.material_name;
END;
$$;
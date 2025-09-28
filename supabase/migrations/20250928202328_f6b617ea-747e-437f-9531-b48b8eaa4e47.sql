-- Adicionar constraint única para evitar erro de ON CONFLICT
ALTER TABLE taxonomy_terms ADD CONSTRAINT unique_taxonomy_code UNIQUE (taxonomy_id, code);

-- Corrigir a função de importação para não usar código quando não existe
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
    -- Verificar se já existe
    IF NOT EXISTS (
      SELECT 1 FROM taxonomy_terms 
      WHERE taxonomy_id = category_taxonomy_id 
      AND name = category_record.name
    ) THEN
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
      );
      imported_categories := imported_categories + 1;
    END IF;
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
      -- Verificar se já existe
      IF NOT EXISTS (
        SELECT 1 FROM taxonomy_terms 
        WHERE taxonomy_id = subcategory_taxonomy_id 
        AND name = subcategory_record.name
      ) THEN
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
        );
        imported_subcategories := imported_subcategories + 1;
      END IF;
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
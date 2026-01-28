-- =====================================================
-- REORGANIZAÇÃO DA TAXONOMIA: Separar Tipos de Categorias
-- =====================================================

-- Mapeamento de subcategorias para suas categorias corretas
-- FIN_SAL -> SAL (Salgados)
-- FIN_DOC -> DOC (Doces & Confeitaria)  
-- FIN_BEB -> BEB (Bebidas)
-- COM_KIT -> KIT (Kits & Mesas)

-- 1. Atualizar materiais finished_product com subcategory de Salgados -> category = SAL
UPDATE materials
SET 
  category_term_id = '00dee3ef-5357-4f6e-b37f-7514cb535ebd', -- SAL - Salgados
  category = 'Salgados'
WHERE subcategory_term_id IN (
  'ccd30277-e5c1-4ef8-8190-f63f5043404f' -- FIN_SAL - Salgados (sanduíches, tortinhas, quiches)
)
AND category_term_id = '15779b20-b18c-43a7-9440-83e15d2c489f'; -- FIN - Produto Acabado

-- 2. Atualizar materiais finished_product com subcategory de Doces -> category = DOC
UPDATE materials
SET 
  category_term_id = 'b41a87a8-7e4d-46bc-9145-547b46388f24', -- DOC - Doces & Confeitaria
  category = 'Doces & Confeitaria'
WHERE subcategory_term_id IN (
  '8fbcd1c5-15eb-4064-9f0b-5cd3fd8e2464' -- FIN_DOC - Doces (bolos, tortas, confeitaria)
)
AND category_term_id = '15779b20-b18c-43a7-9440-83e15d2c489f'; -- FIN - Produto Acabado

-- 3. Atualizar materiais finished_product com subcategory de Bebidas -> category = BEB
UPDATE materials
SET 
  category_term_id = '709acb40-2fc8-41c6-8a49-a759ae8e4a5f', -- BEB - Bebidas
  category = 'Bebidas'
WHERE subcategory_term_id IN (
  'b3b1162f-89b9-41a0-bf93-7cbe74397394' -- FIN_BEB - Bebidas (cafés, chás, sucos)
)
AND category_term_id = '15779b20-b18c-43a7-9440-83e15d2c489f'; -- FIN - Produto Acabado

-- 4. Atualizar materiais composite_product -> category = KIT
UPDATE materials
SET 
  category_term_id = 'e1cd4520-91c1-4d75-9960-5d0071b96fcd', -- KIT - Kits & Mesas
  category = 'Kits & Mesas'
WHERE category_term_id = '8b93b5b9-a23b-4604-9d17-0b92c2796e47' -- COM - Produto Composto
AND material_type = 'composite_product';

-- 5. Atualizar materiais que ainda usam FIN sem subcategory específica -> usar subcategory como category
UPDATE materials
SET 
  category_term_id = subcategory_term_id,
  category = subcategory
WHERE category_term_id = '15779b20-b18c-43a7-9440-83e15d2c489f' -- FIN - Produto Acabado
AND subcategory_term_id IS NOT NULL;

-- 6. Atualizar materiais ingredient que usam INS -> category = ALI (Alimentos & Ingredientes)
UPDATE materials
SET 
  category_term_id = 'ad0e981e-a272-4433-8ffc-d3cdd4ece172', -- ALI - Alimentos & Ingredientes
  category = 'Alimentos & Ingredientes'
WHERE category_term_id = '9a10d072-9b83-4e71-a558-7acbd38b08b9' -- INS - Insumo
AND material_type = 'ingredient';

-- 7. Re-parentear subcategorias que estão sob FIN para SAL, DOC ou BEB
-- FIN_SAL -> parent = SAL
UPDATE taxonomy_terms
SET parent_id = '00dee3ef-5357-4f6e-b37f-7514cb535ebd' -- SAL
WHERE id = 'ccd30277-e5c1-4ef8-8190-f63f5043404f'; -- FIN_SAL

-- FIN_DOC -> parent = DOC
UPDATE taxonomy_terms
SET parent_id = 'b41a87a8-7e4d-46bc-9145-547b46388f24' -- DOC
WHERE id = '8fbcd1c5-15eb-4064-9f0b-5cd3fd8e2464'; -- Doces (bolos, tortas)

-- FIN_BEB -> parent = BEB
UPDATE taxonomy_terms
SET parent_id = '709acb40-2fc8-41c6-8a49-a759ae8e4a5f' -- BEB
WHERE id = 'b3b1162f-89b9-41a0-bf93-7cbe74397394'; -- Bebidas

-- Outros Acabados -> parent = OPE (Operacionais)
UPDATE taxonomy_terms
SET parent_id = '32839958-10ec-4d34-a644-bf4b15bcb61d' -- OPE
WHERE id = '66aaeedd-c03e-4588-a884-2c474f878838'; -- Outros Acabados

-- 8. Re-parentear subcategorias de INS para ALI
UPDATE taxonomy_terms
SET parent_id = 'ad0e981e-a272-4433-8ffc-d3cdd4ece172' -- ALI
WHERE parent_id = '9a10d072-9b83-4e71-a558-7acbd38b08b9'; -- INS

-- 9. Re-parentear subcategorias de INT (Produto Intermediário) para DOC
UPDATE taxonomy_terms
SET parent_id = 'b41a87a8-7e4d-46bc-9145-547b46388f24' -- DOC
WHERE parent_id = '96d350cc-8b60-4b6a-8e60-550e593d38b0'; -- INT

-- 10. Re-parentear subcategorias de COM para KIT
UPDATE taxonomy_terms
SET parent_id = 'e1cd4520-91c1-4d75-9960-5d0071b96fcd' -- KIT
WHERE parent_id = '8b93b5b9-a23b-4604-9d17-0b92c2796e47'; -- COM

-- 11. Desativar (não deletar) os termos de "tipo" para manter histórico
-- Isso evita problemas com foreign keys e permite auditoria
UPDATE taxonomy_terms
SET is_active = false
WHERE id IN (
  '9a10d072-9b83-4e71-a558-7acbd38b08b9', -- INS - Insumo
  '96d350cc-8b60-4b6a-8e60-550e593d38b0', -- INT - Produto Intermediário
  '15779b20-b18c-43a7-9440-83e15d2c489f', -- FIN - Produto Acabado
  '8b93b5b9-a23b-4604-9d17-0b92c2796e47', -- COM - Produto Composto
  'ea9b4c7d-e848-451f-a8b4-b59876e5aaf2'  -- REV - Produto de Revenda
);

-- 12. Renomear subcategorias para remover redundância
UPDATE taxonomy_terms
SET name = 'Sanduíches, Tortinhas & Quiches'
WHERE id = 'ccd30277-e5c1-4ef8-8190-f63f5043404f';

UPDATE taxonomy_terms
SET name = 'Bolos, Tortas & Confeitaria'
WHERE id = '8fbcd1c5-15eb-4064-9f0b-5cd3fd8e2464';

UPDATE taxonomy_terms
SET name = 'Cafés, Chás & Sucos'
WHERE id = 'b3b1162f-89b9-41a0-bf93-7cbe74397394';
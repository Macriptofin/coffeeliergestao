
-- ================================================================
-- CORREÇÃO DA HIERARQUIA DE CATEGORIAS DE MATERIAIS
-- ================================================================

-- IDs dos tipos (material_type)
-- Insumo:              d2498815-bbd6-4f94-957b-d134c8823d32
-- Embalagem:           8c31df83-585c-4412-b6a0-bd0be8eee94a (já ok)
-- Produto Intermediário: 6131ef24-9980-4cf1-98be-74a7b8643790
-- Produto Acabado:     e263616d-2bc2-47b7-992b-1813621c4479
-- Produto Composto:    f0255968-b549-4cd4-b645-8a828ed00bca
-- Produto de Revenda:  70a8b861-59ec-44f2-b626-fa3787b3be0a
-- Material de Limpeza: 97943aaa-7876-4f9e-bed1-3c9a29f5670a
-- Material de Consumo: 500645da-10db-4f68-aa88-c4d2f22ba4dc

-- taxonomy_id for material_category: a7611a13-0a3c-47ce-b007-c902f7fdb39f
-- taxonomy_id for material_subcategory: e7a079a7-abe9-4807-a663-c40e8d620a66

-- ================================================================
-- 1. VINCULAR CATEGORIAS EXISTENTES AOS TIPOS (UPDATE parent_id)
-- ================================================================

-- Insumo → Alimentos & Ingredientes
UPDATE taxonomy_terms SET parent_id = 'd2498815-bbd6-4f94-957b-d134c8823d32'
WHERE id = 'ad0e981e-a272-4433-8ffc-d3cdd4ece172';

-- Produto Acabado → Doces & Confeitaria (primary home)
UPDATE taxonomy_terms SET parent_id = 'e263616d-2bc2-47b7-992b-1813621c4479'
WHERE id = 'b41a87a8-7e4d-46bc-9145-547b46388f24';

-- Produto Acabado → Bebidas (primary home)
UPDATE taxonomy_terms SET parent_id = 'e263616d-2bc2-47b7-992b-1813621c4479'
WHERE id = '709acb40-2fc8-41c6-8a49-a759ae8e4a5f';

-- Produto Composto → Kits & Mesas
UPDATE taxonomy_terms SET parent_id = 'f0255968-b549-4cd4-b645-8a828ed00bca'
WHERE id = 'e1cd4520-91c1-4d75-9960-5d0071b96fcd';

-- Material de Limpeza → Higiene e Limpeza
UPDATE taxonomy_terms SET parent_id = '97943aaa-7876-4f9e-bed1-3c9a29f5670a'
WHERE id = 'fb13d482-07d3-466e-9d56-f954a0b0fa6c';

-- Material de Consumo → Equipamentos
UPDATE taxonomy_terms SET parent_id = '500645da-10db-4f68-aa88-c4d2f22ba4dc'
WHERE id = '0bc6ded0-ecca-4f3c-8067-77aa3f2ac07d';

-- Material de Consumo → Utensílios
UPDATE taxonomy_terms SET parent_id = '500645da-10db-4f68-aa88-c4d2f22ba4dc'
WHERE id = 'e5ff34c5-04a4-4e8a-a88f-2cde2cb37e2f';

-- Material de Consumo → Têxteis & Apoios
UPDATE taxonomy_terms SET parent_id = '500645da-10db-4f68-aa88-c4d2f22ba4dc'
WHERE id = 'e34b826b-93dd-4876-a6b1-04f9e6f98060';

-- Material de Consumo → Infraestrutura & Eventos
UPDATE taxonomy_terms SET parent_id = '500645da-10db-4f68-aa88-c4d2f22ba4dc'
WHERE id = '9db160c4-4ffd-445d-ad36-ee068166dae2';

-- Material de Consumo → Operacionais
UPDATE taxonomy_terms SET parent_id = '500645da-10db-4f68-aa88-c4d2f22ba4dc'
WHERE id = '32839958-10ec-4d34-a644-bf4b15bcb61d';

-- ================================================================
-- 2. CRIAR CLONES DE CATEGORIAS PARA TIPOS QUE COMPARTILHAM
-- ================================================================

-- Clone: Bebidas para Insumo (líquidos base usados em receitas)
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES ('a1b2c3d4-1111-4000-a000-000000000001', 'a7611a13-0a3c-47ce-b007-c902f7fdb39f', 
        'd2498815-bbd6-4f94-957b-d134c8823d32', 'INS_BEB', 'Bebidas (Base)', 20, true);

-- Subcategorias para Bebidas (Base) no Insumo
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES 
  ('a1b2c3d4-1111-4000-a000-000000000011', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-1111-4000-a000-000000000001', 'INS_BEB_LIQ', 'Líquidos Base (água, leite, xaropes)', 1, true),
  ('a1b2c3d4-1111-4000-a000-000000000012', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-1111-4000-a000-000000000001', 'INS_BEB_SUC', 'Sucos & Polpas', 2, true),
  ('a1b2c3d4-1111-4000-a000-000000000013', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-1111-4000-a000-000000000001', 'INS_BEB_CAF', 'Cafés & Chás (grãos, pó, sachê)', 3, true);

-- Clone: Doces & Confeitaria para Produto Intermediário (massas, recheios, caldas)
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES ('a1b2c3d4-2222-4000-a000-000000000002', 'a7611a13-0a3c-47ce-b007-c902f7fdb39f', 
        '6131ef24-9980-4cf1-98be-74a7b8643790', 'INT_DOC', 'Doces & Confeitaria (Bases)', 10, true);

-- Subcategorias para Doces & Confeitaria (Bases) no Produto Intermediário
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES 
  ('a1b2c3d4-2222-4000-a000-000000000021', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000002', 'INT_DOC_MAS', 'Massas & Bases', 1, true),
  ('a1b2c3d4-2222-4000-a000-000000000022', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000002', 'INT_DOC_REC', 'Recheios & Coberturas', 2, true),
  ('a1b2c3d4-2222-4000-a000-000000000023', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000002', 'INT_DOC_CAL', 'Caldas & Molhos', 3, true),
  ('a1b2c3d4-2222-4000-a000-000000000024', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000002', 'INT_DOC_BEB', 'Bases de Bebidas (xaropes, concentrados)', 4, true);

-- Clone: Salgados para Produto Intermediário (massas de salgados)
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES ('a1b2c3d4-2222-4000-a000-000000000003', 'a7611a13-0a3c-47ce-b007-c902f7fdb39f', 
        '6131ef24-9980-4cf1-98be-74a7b8643790', 'INT_SAL', 'Salgados (Bases)', 20, true);

-- Subcategorias para Salgados (Bases) no Produto Intermediário
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES 
  ('a1b2c3d4-2222-4000-a000-000000000031', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000003', 'INT_SAL_MAS', 'Massas de Salgados', 1, true),
  ('a1b2c3d4-2222-4000-a000-000000000032', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-2222-4000-a000-000000000003', 'INT_SAL_MOL', 'Molhos & Recheios Salgados', 2, true);

-- Clone: Bebidas para Produto de Revenda (industrializadas)
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES ('a1b2c3d4-3333-4000-a000-000000000004', 'a7611a13-0a3c-47ce-b007-c902f7fdb39f', 
        '70a8b861-59ec-44f2-b626-fa3787b3be0a', 'REV_BEB', 'Bebidas (Revenda)', 10, true);

-- Subcategorias para Bebidas (Revenda)
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES 
  ('a1b2c3d4-3333-4000-a000-000000000041', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-3333-4000-a000-000000000004', 'REV_BEB_REF', 'Refrigerantes', 1, true),
  ('a1b2c3d4-3333-4000-a000-000000000042', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-3333-4000-a000-000000000004', 'REV_BEB_AGU', 'Águas', 2, true),
  ('a1b2c3d4-3333-4000-a000-000000000043', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-3333-4000-a000-000000000004', 'REV_BEB_SUC', 'Sucos Prontos', 3, true),
  ('a1b2c3d4-3333-4000-a000-000000000044', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'a1b2c3d4-3333-4000-a000-000000000004', 'REV_BEB_ENE', 'Energéticos', 4, true);

-- ================================================================
-- 3. SUBCATEGORIAS DE LIMPEZA (para Higiene e Limpeza)
-- ================================================================
INSERT INTO taxonomy_terms (id, taxonomy_id, parent_id, code, name, sort_order, is_active)
VALUES 
  ('a1b2c3d4-4444-4000-a000-000000000051', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'fb13d482-07d3-466e-9d56-f954a0b0fa6c', 'HIG_DET', 'Detergentes & Sabões', 1, true),
  ('a1b2c3d4-4444-4000-a000-000000000052', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'fb13d482-07d3-466e-9d56-f954a0b0fa6c', 'HIG_DES', 'Desinfetantes & Sanitizantes', 2, true),
  ('a1b2c3d4-4444-4000-a000-000000000053', 'e7a079a7-abe9-4807-a663-c40e8d620a66',
   'fb13d482-07d3-466e-9d56-f954a0b0fa6c', 'HIG_DESC', 'Descartáveis Higiênicos (luvas, papel)', 3, true);

-- ================================================================
-- 4. DESATIVAR SUBCATEGORIAS DUPLICADAS (manter versão ALI_*, desativar INS_*)
-- ================================================================

-- Desativar duplicatas INS_ (manter ALI_ como canônica)
UPDATE taxonomy_terms SET is_active = false WHERE id IN (
  '50355377-5aa5-4523-bda5-e03e1df88a8a', -- INS_GRAO (duplica ALI_GRA)
  '0941e5c7-f760-4830-b752-6bf3cb0d0299', -- INS_LAT (duplica ALI_LAT)
  '8f231650-26b1-4b1c-88c6-c967e962e98b', -- INS_PROT (duplica ALI_PRO)
  'dc04691b-39d7-49e6-902d-01a124759515', -- INS_OLEO (duplica ALI_OLE)
  '03a126ff-57b3-49af-aefc-17065da64a70'  -- INS_ACUC (duplica ALI_ACU)
);

-- Nota: INS_COND (e7ad2243) e ALI_CON (37904ad6) ambos existem
-- Desativar INS_COND em favor de ALI_CON
UPDATE taxonomy_terms SET is_active = false WHERE id = 'e7ad2243-9649-4206-8045-312f2e44ab44';

-- Nota: INS_HORT (480dff16) e ALI_HOR (a6ebfa12) ambos existem
-- Desativar INS_HORT em favor de ALI_HOR
UPDATE taxonomy_terms SET is_active = false WHERE id = '480dff16-9ef5-476a-9a79-e0535f4754ab';

-- Desativar INS_LIQ (c6b8fc14) - líquidos base agora ficam em Bebidas (Base) clone
UPDATE taxonomy_terms SET is_active = false WHERE id = 'c6b8fc14-544a-4799-bf4a-29d12e08615e';

-- Desativar INS_CONS (412330b4) - conservas ficam como subcategoria própria de ALI
-- Manter ativa mas nenhuma duplicata a desativar

-- ================================================================
-- 5. ATUALIZAR MATERIAIS QUE USAM SUBCATEGORIAS DESATIVADAS
-- ================================================================

-- Materiais que usavam INS_HORT → ALI_HOR
UPDATE materials SET subcategory_term_id = 'a6ebfa12-469e-42dc-bb05-54546f037062'
WHERE subcategory_term_id = '480dff16-9ef5-476a-9a79-e0535f4754ab';

-- Materiais que usavam INS_COND → ALI_CON  
UPDATE materials SET subcategory_term_id = '37904ad6-98da-4906-9952-352348768dd0'
WHERE subcategory_term_id = 'e7ad2243-9649-4206-8045-312f2e44ab44';

-- Materiais que usavam INS_ACUC → ALI_ACU
UPDATE materials SET subcategory_term_id = '54022f86-0e44-41ae-ae2a-589dc7ad8330'
WHERE subcategory_term_id = '03a126ff-57b3-49af-aefc-17065da64a70';

-- Materiais que usavam INS_GRAO → ALI_GRA
UPDATE materials SET subcategory_term_id = '43a1b780-de87-494f-add9-c0152cb3e003'
WHERE subcategory_term_id = '50355377-5aa5-4523-bda5-e03e1df88a8a';

-- Materiais que usavam INS_LAT → ALI_LAT
UPDATE materials SET subcategory_term_id = '3fba7fe8-e7ff-4e77-b1e8-87f271295611'
WHERE subcategory_term_id = '0941e5c7-f760-4830-b752-6bf3cb0d0299';

-- Materiais que usavam INS_PROT → ALI_PRO
UPDATE materials SET subcategory_term_id = 'f516e9c9-e95a-4e93-9806-4e0b7cb3cf93'
WHERE subcategory_term_id = '8f231650-26b1-4b1c-88c6-c967e962e98b';

-- Materiais que usavam INS_OLEO → ALI_OLE
UPDATE materials SET subcategory_term_id = 'b50b4816-58b7-46b6-a928-fc9a76392312'
WHERE subcategory_term_id = 'dc04691b-39d7-49e6-902d-01a124759515';

-- ================================================================
-- 6. ATUALIZAR category_term_id NOS MATERIAIS QUE ESTAVAM NULL
-- ================================================================

-- Materiais tipo ingredient com categoria "Alimentos & Ingredientes" sem category_term_id
UPDATE materials SET category_term_id = 'ad0e981e-a272-4433-8ffc-d3cdd4ece172'
WHERE category = 'Alimentos & Ingredientes' AND category_term_id IS NULL;

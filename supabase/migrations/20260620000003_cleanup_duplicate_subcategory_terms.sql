-- Limpeza da taxonomia de subcategorias: desativa duplicatas/legado não-canônicos.
-- Guarda dupla: (1) conjunto canônico explícito (53 termos) sempre preservado,
-- (2) nunca desativa termo referenciado por material ATIVO. Itens arquivados podem
-- manter ponteiros para termos desativados — is_active é só flag de exibição, não quebra refs.

-- 1) Renomeação canônica: "Higiene (álcool, papel, luvas)" -> "Higiene".
UPDATE public.taxonomy_terms SET name='Higiene' WHERE id='b2f61b82-ebe0-4625-93e5-2b4bc0697a3c';

-- 2) Desativa subcategorias não-canônicas sem referência ativa.
WITH keep(id) AS (VALUES
 ('43a1b780-de87-494f-add9-c0152cb3e003'),('3fba7fe8-e7ff-4e77-b1e8-87f271295611'),('f516e9c9-e95a-4e93-9806-4e0b7cb3cf93'),
 ('a6ebfa12-469e-42dc-bb05-54546f037062'),('b50b4816-58b7-46b6-a928-fc9a76392312'),('37904ad6-98da-4906-9952-352348768dd0'),
 ('54022f86-0e44-41ae-ae2a-589dc7ad8330'),('17bea4c5-fa99-4b1b-a6c6-cf5ded653d4d'),('0cb482c6-404e-4742-8078-1b6fa73cc61d'),
 ('412330b4-67f5-45d5-bfc7-10db83126de8'),('c6b8fc14-544a-4799-bf4a-29d12e08615e'),('ecdbb26d-7a96-4b97-a85e-41c99a34c3c7'),
 ('c6a04917-f007-40e0-8d1c-82ce133d93b9'),('bb918b44-11b3-4a4e-a693-ebad8bf93f36'),('b07c997b-bb9b-449c-b2ee-3d9a476d98a7'),
 ('b3b1162f-89b9-41a0-bf93-7cbe74397394'),('8de4541e-ca41-4330-a877-efefb3eba9ea'),('abeaf73f-154f-429f-91ba-36a33f694f78'),
 ('70e2fc80-8747-47c0-9462-127dd85e9f71'),('06b23816-d75b-4c61-8ec1-f4133b829f69'),('1d64100c-6e25-483d-9683-a3b357c849c1'),
 ('4816f2f6-8164-4e6d-9200-7c440f74a9ed'),('0cd438ab-a555-4c96-bd96-6da29b4f76d2'),('4df08136-be6d-415f-8f01-52163d2bf8f1'),
 ('2d6b72ba-6649-423f-8e4d-e894a243e7d2'),('b2738765-db20-4626-87eb-494654c331e5'),('68611cd6-6f75-4978-ae4b-1ad72bc211fa'),
 ('d0637710-e526-4d41-b7c0-3cdf2d8dec79'),('7566346c-0574-42db-a7d6-504d2d74b733'),('e1cdd71f-c27f-46e7-ac31-7675e4f918b5'),
 ('118d2cfb-b734-4612-9f92-3a7c4b6dcd0a'),
 ('490bbd64-3951-4e20-8906-1ccdf3402e53'),('172ecded-e526-4461-b04b-50ed94e50e74'),('bfdd347a-87a6-475d-83b9-cb948a6614e9'),
 ('0a720c8d-1069-4ab8-b52e-f0b82b078957'),
 ('11effe26-8908-4539-a140-adf376645cfe'),('a1b2c3d4-4444-4000-a000-000000000051'),('a1b2c3d4-4444-4000-a000-000000000052'),
 ('b2f61b82-ebe0-4625-93e5-2b4bc0697a3c'),('a1b2c3d4-4444-4000-a000-000000000053'),
 ('96420ad8-a386-4399-a141-c4341eb5820e'),('5007d862-6d38-44c4-869c-11a6290c2112'),('30b6fe14-72b5-4768-80e4-a04842fc3626'),
 ('fe43570d-4b1c-4865-a6a4-46a653fb4f00'),('5b6da7cd-ce02-4039-951a-f05a0c659a9a'),('95f0d3cd-6879-48e8-8bcf-5ab310f20c2e'),
 ('d0e69bc5-6910-433f-981c-419cc01777e7'),('66aaeedd-c03e-4588-a884-2c474f878838'),('c18f1db6-b627-4e13-a5f6-22714e4cbdf5'),
 ('d29e99a6-3c12-47a1-823a-c2ad71961ecc'),('3a8f9333-e5be-4227-83bc-866681222938'),('fd7e2925-1052-46f9-bfd0-5b73493178c8'),
 ('d0427e30-39c5-41a8-9a94-bd8a45025b79')
),
refs AS (SELECT DISTINCT subcategory_term_id sid FROM public.materials WHERE subcategory_term_id IS NOT NULL AND is_archived=false)
UPDATE public.taxonomy_terms t SET is_active=false
WHERE t.taxonomy_id=(SELECT id FROM public.taxonomy_definitions WHERE key='material_subcategory')
  AND t.is_active=true
  AND t.id NOT IN (SELECT id::uuid FROM keep)
  AND t.id NOT IN (SELECT sid FROM refs);

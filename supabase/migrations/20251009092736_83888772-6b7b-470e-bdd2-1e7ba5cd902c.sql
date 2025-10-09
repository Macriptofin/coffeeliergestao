-- Adicionar códigos faltantes para subcategorias de materiais

-- Insumo (INS)
UPDATE taxonomy_terms SET code = 'INS_PAN' WHERE id = 'dbe1fb02-a6fc-485f-9927-6853822708a5'; -- Panificados
UPDATE taxonomy_terms SET code = 'INS_COND' WHERE id = 'e7ad2243-9649-4206-8045-312f2e44ab44'; -- Condimentos & Temperos
UPDATE taxonomy_terms SET code = 'INS_HORT' WHERE id = '480dff16-9ef5-476a-9a79-e0535f4754ab'; -- Hortifruti
UPDATE taxonomy_terms SET code = 'INS_GRAO' WHERE id = '50355377-5aa5-4523-bda5-e03e1df88a8a'; -- Grãos & Cereais
UPDATE taxonomy_terms SET code = 'INS_LAT' WHERE id = '0941e5c7-f760-4830-b752-6bf3cb0d0299'; -- Laticínios
UPDATE taxonomy_terms SET code = 'INS_PROT' WHERE id = '8f231650-26b1-4b1c-88c6-c967e962e98b'; -- Proteínas
UPDATE taxonomy_terms SET code = 'INS_OLEO' WHERE id = 'dc04691b-39d7-49e6-902d-01a124759515'; -- Óleos & Gorduras

-- Embalagem (EMB)
UPDATE taxonomy_terms SET code = 'EMB_DESC' WHERE id = '490bbd64-3951-4e20-8906-1ccdf3402e53'; -- Descartáveis
UPDATE taxonomy_terms SET code = 'EMB_PRI' WHERE id = '172ecded-e526-4461-b04b-50ed94e50e74'; -- Embalagens Primárias
UPDATE taxonomy_terms SET code = 'EMB_SEC' WHERE id = 'bfdd347a-87a6-475d-83b9-cb948a6614e9'; -- Embalagens Secundárias
UPDATE taxonomy_terms SET code = 'EMB_ROT' WHERE id = '0a720c8d-1069-4ab8-b52e-f0b82b078957'; -- Etiquetas & Rótulos

-- Produto Acabado (FIN)
UPDATE taxonomy_terms SET code = 'FIN_BEB_GEN' WHERE id = '498263bb-1d4b-40c4-b941-b8b7c266ec91'; -- Bebidas (genérico)
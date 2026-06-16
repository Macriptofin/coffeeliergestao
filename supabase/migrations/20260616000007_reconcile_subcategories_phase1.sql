-- Fase 1 (subcategorias): consolida duplicatas, normaliza texto drifado,
-- cria termos canônicos faltantes e faz backfill de subcategory_term_id.

-- A) Materiais que referenciam termos DUPLICADOS -> termo canônico (term_id + texto)
UPDATE materials SET subcategory_term_id='17bea4c5-fa99-4b1b-a6c6-cf5ded653d4d', subcategory='Panificados'
  WHERE subcategory_term_id='dbe1fb02-a6fc-485f-9927-6853822708a5';                 -- INS_PAN -> ALI_PAN
UPDATE materials SET subcategory_term_id='4816f2f6-8164-4e6d-9200-7c440f74a9ed', subcategory='Recheios & Coberturas'
  WHERE subcategory_term_id='647696d2-6261-4e21-bf25-a0d4e50ee8ee';                 -- INT_REC -> DOC_REC
UPDATE materials SET subcategory_term_id='70e2fc80-8747-47c0-9462-127dd85e9f71', subcategory='Bolos & Tortas'
  WHERE subcategory_term_id='8fbcd1c5-15eb-4064-9f0b-5cd3fd8e2464';                 -- FIN_DOC -> DOC_BOL

-- B) Cesta de Natal: estava em Alimentos -> Kits & Mesas / Cestas
UPDATE materials SET category='Kits & Mesas', category_term_id='e1cd4520-91c1-4d75-9960-5d0071b96fcd',
  subcategory='Cestas', subcategory_term_id='fd7e2925-1052-46f9-bfd0-5b73493178c8'
  WHERE code='INS0133';

-- C) Normalizar texto drifado -> canônico
UPDATE materials SET subcategory='Bolos & Tortas'
  WHERE category='Doces & Confeitaria'
    AND subcategory IN ('Bolos, Tortas & Confeitaria','Doces (bolos, tortas, confeitaria)');
UPDATE materials SET subcategory='Sanduíches'
  WHERE category='Salgados' AND subcategory='Salgados (sanduíches, tortinhas, quiches)';
UPDATE materials SET subcategory='Líquidos Base'
  WHERE category='Alimentos & Ingredientes' AND subcategory='Líquidos & Bebidas Base';

-- D) Criar/reativar termos canônicos faltantes
UPDATE taxonomy_terms SET is_active=true, name='Líquidos Base'
  WHERE id='c6b8fc14-544a-4799-bf4a-29d12e08615e';                                  -- INS_LIQ (Alimentos)
INSERT INTO taxonomy_terms (taxonomy_id, parent_id, code, name, sort_order, is_active) VALUES
  ('e7a079a7-abe9-4807-a663-c40e8d620a66','00dee3ef-5357-4f6e-b37f-7514cb535ebd','SAL_MAS','Massas & Bases',6,true),
  ('e7a079a7-abe9-4807-a663-c40e8d620a66','00dee3ef-5357-4f6e-b37f-7514cb535ebd','SAL_MOL','Molhos & Recheios',7,true);

-- E) Inativar as 5 subcategorias DUPLICADAS (já liberadas no passo A)
UPDATE taxonomy_terms SET is_active=false WHERE id IN (
  'dbe1fb02-a6fc-485f-9927-6853822708a5', -- INS_PAN
  '372ff8b1-7fb1-4c42-8a30-e066ff92c425', -- INT_MAS
  '647696d2-6261-4e21-bf25-a0d4e50ee8ee', -- INT_REC
  'ef4b572c-5dc1-4417-9b1e-29093322b3b5', -- INT_CAL
  '8fbcd1c5-15eb-4064-9f0b-5cd3fd8e2464'  -- FIN_DOC
);

-- F) Backfill: liga subcategory_term_id por match exato texto<->termo ATIVO sob a categoria
UPDATE materials m SET subcategory_term_id = t.id
FROM taxonomy_terms t
JOIN taxonomy_definitions d ON d.id = t.taxonomy_id AND d.key = 'material_subcategory'
WHERE t.parent_id = m.category_term_id
  AND t.is_active = true
  AND lower(trim(t.name)) = lower(trim(m.subcategory))
  AND coalesce(m.is_archived,false) = false
  AND coalesce(m.subcategory,'') <> ''
  AND m.subcategory_term_id IS DISTINCT FROM t.id;

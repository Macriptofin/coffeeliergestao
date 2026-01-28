-- Adicionar novos tipos de material à taxonomia
INSERT INTO taxonomy_terms (taxonomy_id, code, name, parent_id, sort_order, is_active)
VALUES 
  ('f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', 'REV', 'Produto de Revenda', NULL, 6, true),
  ('f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', 'LIM', 'Material de Limpeza', NULL, 7, true),
  ('f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c', 'CON', 'Material de Consumo', NULL, 8, true)
ON CONFLICT (taxonomy_id, code) DO NOTHING;
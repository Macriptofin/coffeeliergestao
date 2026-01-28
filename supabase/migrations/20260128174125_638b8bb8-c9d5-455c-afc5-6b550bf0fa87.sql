-- Padronizar códigos dos tipos de material
UPDATE taxonomy_terms
SET code = CASE 
  WHEN code = 'TIPO_INS' OR name = 'Insumo' THEN 'INS00001'
  WHEN code = 'TIPO_EMB' OR name = 'Embalagem' THEN 'EMB00002'
  WHEN code = 'TIPO_INT' OR name = 'Produto Intermediário' THEN 'INT00003'
  WHEN code = 'TIPO_FIN' OR name = 'Produto Acabado' THEN 'FIN00004'
  WHEN code = 'TIPO_COM' OR name = 'Produto Composto' THEN 'COM00005'
  WHEN code = 'REV' OR name = 'Produto de Revenda' THEN 'REV00006'
  WHEN code = 'LIM' OR name = 'Material de Limpeza' THEN 'LIM00007'
  WHEN code = 'CON' OR name = 'Material de Consumo' THEN 'CON00008'
  ELSE code
END
WHERE taxonomy_id = 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c';
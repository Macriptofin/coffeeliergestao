-- Ajustar códigos para 3 dígitos numéricos
UPDATE taxonomy_terms
SET code = CASE 
  WHEN code = 'INS00001' THEN 'INS001'
  WHEN code = 'EMB00002' THEN 'EMB002'
  WHEN code = 'INT00003' THEN 'INT003'
  WHEN code = 'FIN00004' THEN 'FIN004'
  WHEN code = 'COM00005' THEN 'COM005'
  WHEN code = 'REV00006' THEN 'REV006'
  WHEN code = 'LIM00007' THEN 'LIM007'
  WHEN code = 'CON00008' THEN 'CON008'
  ELSE code
END
WHERE taxonomy_id = 'f8a9b7c6-5d4e-3f2a-1b0c-9d8e7f6a5b4c';
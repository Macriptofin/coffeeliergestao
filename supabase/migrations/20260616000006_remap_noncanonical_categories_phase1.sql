-- Fase 1: materiais em "categorias" não-canônicas (tipo disfarçado de categoria,
-- variantes de Bebidas, Bases, etc.) reatribuídos à categoria de NEGÓCIO correta.
-- Define texto + category_term_id; subcategory_term_id será re-backfillado no passo
-- de reconciliação das subcategorias (o texto canônico já fica setado aqui).

UPDATE materials m SET
  category = x.cat,
  category_term_id = x.cat_id::uuid,
  subcategory = nullif(x.sub, ''),
  subcategory_term_id = NULL
FROM (VALUES
  ('INT0022','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0019','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0013','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0018','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0007','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0010','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0008','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0012','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0016','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0005','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Massas & Bases'),
  ('INT0017','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0009','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0006','Doces & Confeitaria','b41a87a8-7e4d-46bc-9145-547b46388f24','Recheios & Coberturas'),
  ('INT0020','Salgados','00dee3ef-5357-4f6e-b37f-7514cb535ebd','Massas & Bases'),
  ('INT0021','Salgados','00dee3ef-5357-4f6e-b37f-7514cb535ebd','Molhos & Recheios'),
  ('INS0124','Salgados','00dee3ef-5357-4f6e-b37f-7514cb535ebd','Salgados Assados'),
  ('INT0014','Salgados','00dee3ef-5357-4f6e-b37f-7514cb535ebd','Massas & Bases'),
  ('INT0015','Salgados','00dee3ef-5357-4f6e-b37f-7514cb535ebd','Massas & Bases'),
  ('FIN0017','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Bebidas Alcoólicas'),
  ('INS0159','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Águas'),
  ('INS0182','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Cafés, Chás & Sucos'),
  ('INS0062','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Refrigerantes'),
  ('INS0155','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Refrigerantes'),
  ('INS0039','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Sucos & Néctares'),
  ('INS0045','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Sucos & Néctares'),
  ('PAC0001','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Sucos & Néctares'),
  ('INS0134','Bebidas','709acb40-2fc8-41c6-8a49-a759ae8e4a5f','Cafés, Chás & Sucos'),
  ('INS0158','Higiene e Limpeza','fb13d482-07d3-466e-9d56-f954a0b0fa6c','Detergentes & Sabões'),
  ('INS0156','Equipamentos','0bc6ded0-ecca-4f3c-8067-77aa3f2ac07d',''),
  ('INS0181','Operacionais','32839958-10ec-4d34-a644-bf4b15bcb61d',''),
  ('INS0198','Operacionais','32839958-10ec-4d34-a644-bf4b15bcb61d','Têxteis'),
  ('INS0238','Operacionais','32839958-10ec-4d34-a644-bf4b15bcb61d','Infraestrutura'),
  ('INS0179','Alimentos & Ingredientes','ad0e981e-a272-4433-8ffc-d3cdd4ece172','Cafés & Chás'),
  ('EMB0004','Alimentos & Ingredientes','ad0e981e-a272-4433-8ffc-d3cdd4ece172','Açúcares & Adoçantes'),
  ('FIN0010','Alimentos & Ingredientes','ad0e981e-a272-4433-8ffc-d3cdd4ece172','Hortifruti')
) AS x(code, cat, cat_id, sub)
WHERE m.code = x.code;

UPDATE materials SET material_type = 'supply'     WHERE code IN ('INS0158','INS0238') AND material_type <> 'supply';
UPDATE materials SET material_type = 'equipment'  WHERE code = 'INS0156' AND material_type <> 'equipment';

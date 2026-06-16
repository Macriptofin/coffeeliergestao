-- Itens que não são produtos produzidos estavam como 'finished_product' e poluíam a
-- lista de Fichas Técnicas. Reclassificados conforme a convenção do sistema:
--   operacional/limpeza/equipamento -> 'ingredient'
--   bebidas/itens comprados prontos -> 'resale_product'
-- (Pão de Queijo Premium INS0124 deixado de fora por ser decisão de negócio:
--  produzido in-house x comprado pronto.)

-- Operacional / limpeza / equipamento -> ingredient
UPDATE materials SET material_type = 'ingredient'
WHERE code IN ('INS0181','INS0158','INS0198','INS0156')
  AND material_type = 'finished_product';

-- Bebidas / itens de revenda (comprados prontos, servidos como estão) -> resale_product
UPDATE materials SET material_type = 'resale_product'
WHERE code IN ('INS0153','INS0159','INS0134','INS0182','INS0062','INS0155',
               'EMB0004','INS0039','INS0045','PAC0001')
  AND material_type = 'finished_product';

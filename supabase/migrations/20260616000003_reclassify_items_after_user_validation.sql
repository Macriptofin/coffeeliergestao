-- Correções após validação do usuário (uso real de cada item):
-- Sachê de Açúcar entra na composição de receitas (ex.: café coado) -> ingredient
UPDATE materials SET material_type = 'ingredient'
WHERE code = 'EMB0004' AND material_type = 'resale_product';

-- Vela Estrelar é tecido de revenda, componente de kit (Dia dos Namorados) -> resale_product
UPDATE materials SET material_type = 'resale_product'
WHERE code = 'INS0198' AND material_type = 'ingredient';

-- Pão de Queijo Premium PCT 2kg é comprado pronto (assa e revende) -> resale_product.
-- A versão da casa (receita própria) será cadastrada à parte como finished_product com ficha.
UPDATE materials SET material_type = 'resale_product'
WHERE code = 'INS0124' AND material_type = 'finished_product';


-- Inserir novas contas no plano de contas para DRE gerencial completo

-- Deduções da Receita Bruta (4.2)
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('4.2', '(-) Deduções da Receita Bruta', 'Receitas', 2, 'f49df6c5-f40c-4eec-b982-db072ba4b00c', true);

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.1', '(-) Devoluções de Vendas', 'Receitas', 3, id, true 
FROM chart_of_accounts WHERE code = '4.2';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.2', '(-) Descontos Concedidos', 'Receitas', 3, id, true 
FROM chart_of_accounts WHERE code = '4.2';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.3', '(-) Impostos sobre Vendas', 'Receitas', 3, id, true 
FROM chart_of_accounts WHERE code = '4.2';

-- Subcontas de impostos (4.2.3.x)
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.3.1', '(-) ICMS sobre Vendas', 'Receitas', 4, id, true 
FROM chart_of_accounts WHERE code = '4.2.3';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.3.2', '(-) PIS sobre Vendas', 'Receitas', 4, id, true 
FROM chart_of_accounts WHERE code = '4.2.3';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.2.3.3', '(-) COFINS sobre Vendas', 'Receitas', 4, id, true 
FROM chart_of_accounts WHERE code = '4.2.3';

-- Receitas Financeiras (4.3)
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('4.3', '(+) Receitas Financeiras', 'Receitas', 2, 'f49df6c5-f40c-4eec-b982-db072ba4b00c', true);

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.3.1', '(+) Juros Recebidos', 'Receitas', 3, id, true 
FROM chart_of_accounts WHERE code = '4.3';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '4.3.2', '(+) Rendimentos de Aplicações', 'Receitas', 3, id, true 
FROM chart_of_accounts WHERE code = '4.3';

-- Despesas Financeiras (5.3)
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('5.3', '(-) Despesas Financeiras', 'Despesas', 2, 'b6935725-8853-491f-8ea7-0700d3c58902', true);

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '5.3.1', '(-) Juros Pagos', 'Despesas', 3, id, true 
FROM chart_of_accounts WHERE code = '5.3';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '5.3.2', '(-) Taxas Bancárias', 'Despesas', 3, id, true 
FROM chart_of_accounts WHERE code = '5.3';

INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) 
SELECT '5.3.3', '(-) IOF', 'Despesas', 3, id, true 
FROM chart_of_accounts WHERE code = '5.3';

-- Depreciação e Amortização (5.4)
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('5.4', '(-) Depreciação e Amortização', 'Despesas', 2, 'b6935725-8853-491f-8ea7-0700d3c58902', true);

-- Subcontas de 5.1 - Custos dos Produtos Vendidos
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('5.1.1', 'Compras de Mercadorias', 'Despesas', 3, '177e0e58-7986-41ba-b436-b43a936c9c10', true),
('5.1.2', 'Matéria-Prima', 'Despesas', 3, '177e0e58-7986-41ba-b436-b43a936c9c10', true);

-- Subcontas de 5.2 - Despesas Operacionais
INSERT INTO chart_of_accounts (code, name, account_type, level, parent_id, is_active) VALUES
('5.2.3', 'Frete e Logística', 'Despesas', 3, 'dfb729ea-8ded-458e-9ea8-f1bcbc379dba', true);

-- Inserir subcategorias nos centros de custo
INSERT INTO cost_centers (code, name, parent_id, is_active) VALUES
('001.1', 'Panificação', '530a3896-c101-4e40-9667-2e336d3b6643', true),
('001.2', 'Confeitaria', '530a3896-c101-4e40-9667-2e336d3b6643', true),
('002.1', 'Varejo', 'ba597d65-1abf-4b28-8b3c-eda284026e02', true),
('002.2', 'Atacado', 'ba597d65-1abf-4b28-8b3c-eda284026e02', true),
('003.1', 'RH/Pessoal', '4ea375b9-8b56-436b-9c76-c8bf126b5e4d', true),
('006', 'Marketing', NULL, true);

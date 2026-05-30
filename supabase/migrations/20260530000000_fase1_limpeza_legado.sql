-- =====================================================
-- FASE 1: Limpeza de campos e tabelas legado
-- Data: 2026-05-30
-- Descrição: Remove campos de texto legado, tabelas da
--            Geração 1 (recipes/products) e FK duplicada.
--            Todos os dados foram confirmados como 0
--            registros ativos antes da remoção.
-- =====================================================

-- ----------------------------------------------------
-- 1. Remover campo legado materials.supplier (texto)
--    Substituto: materials.supplier_id (uuid → suppliers)
-- ----------------------------------------------------
UPDATE materials SET supplier = NULL WHERE supplier IS NOT NULL;
ALTER TABLE materials DROP COLUMN IF EXISTS supplier;

-- ----------------------------------------------------
-- 2. Remover campo legado cash_transactions.bank_account
--    Substituto: cash_transactions.bank_account_id (uuid)
-- ----------------------------------------------------
ALTER TABLE cash_transactions DROP COLUMN IF EXISTS bank_account;

-- ----------------------------------------------------
-- 3. Remover campo legado receipt_transactions.bank_account
--    Substituto: receipt_transactions.bank_account_id (uuid)
-- ----------------------------------------------------
ALTER TABLE receipt_transactions DROP COLUMN IF EXISTS bank_account;

-- ----------------------------------------------------
-- 4. Remover FK duplicada em employee_salary_info
--    Manter: employee_salary_info_employee_id_fkey
--    Remover: employee_salary_info_employee_fkey (duplicata)
-- ----------------------------------------------------
ALTER TABLE employee_salary_info
  DROP CONSTRAINT IF EXISTS employee_salary_info_employee_fkey;

-- ----------------------------------------------------
-- 5. Remover tabelas da Geração 1 (modelo legado de
--    receitas culinárias — substituído por recipes_bom)
--    Confirmado: 0 registros ativos em todas as tabelas
-- ----------------------------------------------------

-- 5a. proposal_items (0 registros) — dependia de products
DROP TABLE IF EXISTS proposal_items CASCADE;

-- 5b. Remover coluna product_id de sales_order_items
--     (referência legado a products, sem FK ativa)
ALTER TABLE sales_order_items DROP COLUMN IF EXISTS product_id;

-- 5c. recipe_ingredients (dados de teste) — dependia de recipes
DROP TABLE IF EXISTS recipe_ingredients CASCADE;

-- 5d. recipes (dados de teste) — modelo legado
DROP TABLE IF EXISTS recipes CASCADE;

-- 5e. products (0 registros ativos) — camada entre proposals e recipes
DROP TABLE IF EXISTS products CASCADE;

-- ----------------------------------------------------
-- 6. Remover invoice_material_matches
--    Substituída por material_name_mappings (mais completa)
-- ----------------------------------------------------
DROP TABLE IF EXISTS invoice_material_matches CASCADE;

-- =====================================================
-- ROLLBACK (se necessário reverter manualmente):
--
-- ALTER TABLE materials ADD COLUMN supplier text;
-- ALTER TABLE cash_transactions ADD COLUMN bank_account text;
-- ALTER TABLE receipt_transactions ADD COLUMN bank_account text;
--
-- Tabelas removidas não têm rollback automático.
-- Restaurar a partir do backup do Supabase se necessário.
-- =====================================================

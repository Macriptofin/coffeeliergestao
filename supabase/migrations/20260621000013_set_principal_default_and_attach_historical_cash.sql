-- Decisão do usuário: "Principal" é a conta padrão única; caixa histórico (sem banco)
-- atribuído a ela para o saldo refletir todo o movimento já lançado.
UPDATE public.bank_accounts SET is_default = (name = 'Principal'), updated_at = now();

UPDATE public.cash_transactions
   SET bank_account_id = (SELECT id FROM public.bank_accounts WHERE name='Principal' LIMIT 1)
 WHERE bank_account_id IS NULL;
-- O trigger trg_sync_bank_balance recalcula current_balance automaticamente.
-- OBS: o saldo INICIAL real de cada conta deve ser informado em Contas Bancárias
-- para o current_balance bater com o extrato.

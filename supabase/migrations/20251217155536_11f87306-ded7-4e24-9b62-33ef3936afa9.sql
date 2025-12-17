-- =====================================================
-- MÓDULO FINANCEIRO AVANÇADO
-- =====================================================

-- 1. TABELA DE CONTAS BANCÁRIAS
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  agency_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'corrente', -- corrente, poupanca, investimento
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para contas bancárias
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage bank_accounts"
ON public.bank_accounts FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Authenticated users can view bank_accounts"
ON public.bank_accounts FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. ADICIONAR CAMPOS NA PURCHASE_INVOICES PARA INTEGRAÇÃO
ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS accounts_payable_generated BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accounts_payable_id UUID REFERENCES public.accounts_payable(id),
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- 3. TABELA DE TRANSAÇÕES RECORRENTES
CREATE TABLE public.recurring_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL, -- Entrada, Saída
  category TEXT NOT NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  frequency TEXT NOT NULL, -- daily, weekly, monthly, yearly
  start_date DATE NOT NULL,
  end_date DATE,
  next_execution DATE NOT NULL,
  last_execution DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS para transações recorrentes
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage recurring_transactions"
ON public.recurring_transactions FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- 4. ADICIONAR CAMPOS PARA BAIXA AUTOMÁTICA EM CONTAS
ALTER TABLE public.accounts_payable 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id),
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS source_type TEXT, -- manual, purchase_invoice, recurring
ADD COLUMN IF NOT EXISTS source_id UUID;

ALTER TABLE public.accounts_receivable 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id),
ADD COLUMN IF NOT EXISTS receipt_date DATE,
ADD COLUMN IF NOT EXISTS source_type TEXT, -- manual, proposal, recurring
ADD COLUMN IF NOT EXISTS source_id UUID;

-- 5. ADICIONAR CONTA BANCÁRIA NO FLUXO DE CAIXA
ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id);

-- 6. TABELA DE CONCILIAÇÃO BANCÁRIA
CREATE TABLE public.bank_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  reconciliation_date DATE NOT NULL,
  statement_balance NUMERIC NOT NULL,
  system_balance NUMERIC NOT NULL,
  difference NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, conciliado, divergente
  notes TEXT,
  reconciled_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para conciliações
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage bank_reconciliations"
ON public.bank_reconciliations FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- 7. TABELA DE ALERTAS FINANCEIROS
CREATE TABLE public.financial_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL, -- vencimento, saldo_baixo, meta_atingida
  reference_type TEXT NOT NULL, -- accounts_payable, accounts_receivable, bank_account
  reference_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info, warning, critical
  due_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  read_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para alertas financeiros
ALTER TABLE public.financial_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage financial_alerts"
ON public.financial_alerts FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- 8. FUNÇÃO PARA GERAR CONTA A PAGAR A PARTIR DE NOTA FISCAL
CREATE OR REPLACE FUNCTION public.generate_accounts_payable_from_invoice(
  p_invoice_id UUID,
  p_due_date DATE DEFAULT NULL,
  p_cost_center_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_payable_id UUID;
  v_due_date DATE;
BEGIN
  -- Buscar dados da nota fiscal
  SELECT pi.*, s.company_name as supplier_name
  INTO v_invoice
  FROM purchase_invoices pi
  LEFT JOIN suppliers s ON s.id = pi.supplier_id
  WHERE pi.id = p_invoice_id;
  
  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada';
  END IF;
  
  IF v_invoice.accounts_payable_generated THEN
    RAISE EXCEPTION 'Conta a pagar já foi gerada para esta nota fiscal';
  END IF;
  
  -- Definir data de vencimento
  v_due_date := COALESCE(p_due_date, v_invoice.payment_due_date, v_invoice.invoice_date + INTERVAL '30 days');
  
  -- Criar conta a pagar
  INSERT INTO accounts_payable (
    supplier_id,
    description,
    document_number,
    invoice_number,
    issue_date,
    due_date,
    original_amount,
    remaining_amount,
    cost_center_id,
    source_type,
    source_id,
    status
  ) VALUES (
    v_invoice.supplier_id,
    'NF ' || v_invoice.invoice_number || ' - ' || COALESCE(v_invoice.supplier_name, 'Fornecedor'),
    v_invoice.invoice_number,
    v_invoice.invoice_number,
    v_invoice.invoice_date,
    v_due_date,
    v_invoice.total_amount,
    v_invoice.total_amount,
    p_cost_center_id,
    'purchase_invoice',
    p_invoice_id,
    'Pendente'
  )
  RETURNING id INTO v_payable_id;
  
  -- Atualizar nota fiscal
  UPDATE purchase_invoices
  SET 
    accounts_payable_generated = true,
    accounts_payable_id = v_payable_id,
    payment_due_date = v_due_date
  WHERE id = p_invoice_id;
  
  RETURN v_payable_id;
END;
$$;

-- 9. FUNÇÃO PARA GERAR ALERTAS DE VENCIMENTO
CREATE OR REPLACE FUNCTION public.generate_due_date_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Alertas para contas a pagar vencendo em 3 dias
  FOR v_record IN
    SELECT id, description, due_date, remaining_amount
    FROM accounts_payable
    WHERE status = 'Pendente'
      AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM financial_alerts 
        WHERE reference_type = 'accounts_payable' 
          AND reference_id = accounts_payable.id
          AND alert_type = 'vencimento'
          AND created_at > CURRENT_DATE - INTERVAL '1 day'
      )
  LOOP
    INSERT INTO financial_alerts (
      alert_type, reference_type, reference_id, title, message, severity, due_date
    ) VALUES (
      'vencimento',
      'accounts_payable',
      v_record.id,
      'Conta a Pagar Vencendo',
      format('A conta "%s" no valor de R$ %s vence em %s', 
        v_record.description, 
        to_char(v_record.remaining_amount, 'FM999G999D00'),
        to_char(v_record.due_date, 'DD/MM/YYYY')),
      CASE WHEN v_record.due_date <= CURRENT_DATE THEN 'critical' ELSE 'warning' END,
      v_record.due_date
    );
  END LOOP;
  
  -- Alertas para contas a receber vencendo em 3 dias
  FOR v_record IN
    SELECT id, description, due_date, remaining_amount
    FROM accounts_receivable
    WHERE status = 'Pendente'
      AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM financial_alerts 
        WHERE reference_type = 'accounts_receivable' 
          AND reference_id = accounts_receivable.id
          AND alert_type = 'vencimento'
          AND created_at > CURRENT_DATE - INTERVAL '1 day'
      )
  LOOP
    INSERT INTO financial_alerts (
      alert_type, reference_type, reference_id, title, message, severity, due_date
    ) VALUES (
      'vencimento',
      'accounts_receivable',
      v_record.id,
      'Conta a Receber Vencendo',
      format('O recebimento "%s" no valor de R$ %s vence em %s', 
        v_record.description, 
        to_char(v_record.remaining_amount, 'FM999G999D00'),
        to_char(v_record.due_date, 'DD/MM/YYYY')),
      CASE WHEN v_record.due_date <= CURRENT_DATE THEN 'critical' ELSE 'warning' END,
      v_record.due_date
    );
  END LOOP;
END;
$$;

-- 10. FUNÇÃO PARA ATUALIZAR SALDO DA CONTA BANCÁRIA
CREATE OR REPLACE FUNCTION public.update_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance + 
        CASE WHEN NEW.transaction_type = 'Entrada' THEN NEW.amount ELSE -NEW.amount END,
        updated_at = now()
      WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance - 
        CASE WHEN OLD.transaction_type = 'Entrada' THEN OLD.amount ELSE -OLD.amount END,
        updated_at = now()
      WHERE id = OLD.bank_account_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter valor antigo
    IF OLD.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance - 
        CASE WHEN OLD.transaction_type = 'Entrada' THEN OLD.amount ELSE -OLD.amount END,
        updated_at = now()
      WHERE id = OLD.bank_account_id;
    END IF;
    -- Aplicar novo valor
    IF NEW.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance + 
        CASE WHEN NEW.transaction_type = 'Entrada' THEN NEW.amount ELSE -NEW.amount END,
        updated_at = now()
      WHERE id = NEW.bank_account_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger para atualizar saldo
DROP TRIGGER IF EXISTS trigger_update_bank_balance ON cash_transactions;
CREATE TRIGGER trigger_update_bank_balance
AFTER INSERT OR UPDATE OR DELETE ON cash_transactions
FOR EACH ROW EXECUTE FUNCTION update_bank_account_balance();

-- 11. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON accounts_payable(due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due_date ON accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_bank_account ON cash_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_alerts_is_read ON financial_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_execution ON recurring_transactions(next_execution);

-- 12. INSERIR CONTA CAIXA PADRÃO
INSERT INTO bank_accounts (name, bank_name, account_type, is_default, notes)
VALUES ('Caixa Geral', 'Caixa Interno', 'caixa', true, 'Conta de caixa padrão do sistema')
ON CONFLICT DO NOTHING;
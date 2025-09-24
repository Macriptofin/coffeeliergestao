-- Criar tabelas para o módulo financeiro

-- Plano de contas
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('Ativo', 'Passivo', 'Patrimônio Líquido', 'Receitas', 'Despesas')),
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Centros de custo
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.cost_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contas a pagar
CREATE TABLE public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id),
  invoice_number TEXT,
  description TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  original_amount NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  interest_amount NUMERIC(15,2) DEFAULT 0,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Vencido', 'Cancelado')),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contas a receber
CREATE TABLE public.accounts_receivable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id),
  proposal_id UUID REFERENCES public.proposals(id),
  invoice_number TEXT,
  description TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  original_amount NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  interest_amount NUMERIC(15,2) DEFAULT 0,
  received_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Recebido', 'Vencido', 'Cancelado')),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Movimentações de pagamento (para contas a pagar)
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Dinheiro', 'PIX', 'Transferência', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Cheque')),
  bank_account TEXT,
  document_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Movimentações de recebimento (para contas a receber)
CREATE TABLE public.receipt_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id),
  receipt_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  receipt_method TEXT NOT NULL CHECK (receipt_method IN ('Dinheiro', 'PIX', 'Transferência', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Cheque')),
  bank_account TEXT,
  document_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Movimentações de caixa (fluxo de caixa)
CREATE TABLE public.cash_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Entrada', 'Saída')),
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT NOT NULL,
  bank_account TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  reference_type TEXT CHECK (reference_type IN ('accounts_payable', 'accounts_receivable', 'manual')),
  reference_id UUID,
  document_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Only admins and managers can manage chart_of_accounts" ON public.chart_of_accounts
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone authenticated can view chart_of_accounts" ON public.chart_of_accounts
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage cost_centers" ON public.cost_centers
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone authenticated can view cost_centers" ON public.cost_centers
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage accounts_payable" ON public.accounts_payable
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can manage accounts_receivable" ON public.accounts_receivable
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can manage payment_transactions" ON public.payment_transactions
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can manage receipt_transactions" ON public.receipt_transactions
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can manage cash_transactions" ON public.cash_transactions
FOR ALL USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_centers_updated_at
BEFORE UPDATE ON public.cost_centers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_payable_updated_at
BEFORE UPDATE ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_transactions_updated_at
BEFORE UPDATE ON public.cash_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default chart of accounts
INSERT INTO public.chart_of_accounts (code, name, account_type, level) VALUES
('1', 'ATIVO', 'Ativo', 1),
('1.1', 'ATIVO CIRCULANTE', 'Ativo', 2),
('1.1.1', 'Disponível', 'Ativo', 3),
('1.1.1.001', 'Caixa', 'Ativo', 4),
('1.1.1.002', 'Bancos Conta Movimento', 'Ativo', 4),
('1.1.2', 'Direitos Realizáveis', 'Ativo', 3),
('1.1.2.001', 'Clientes', 'Ativo', 4),
('1.1.2.002', 'Estoque', 'Ativo', 4),
('2', 'PASSIVO', 'Passivo', 1),
('2.1', 'PASSIVO CIRCULANTE', 'Passivo', 2),
('2.1.1', 'Obrigações', 'Passivo', 3),
('2.1.1.001', 'Fornecedores', 'Passivo', 4),
('2.1.1.002', 'Salários a Pagar', 'Passivo', 4),
('3', 'PATRIMÔNIO LÍQUIDO', 'Patrimônio Líquido', 1),
('3.1', 'Capital Social', 'Patrimônio Líquido', 2),
('4', 'RECEITAS', 'Receitas', 1),
('4.1', 'Receita Bruta', 'Receitas', 2),
('4.1.1', 'Vendas', 'Receitas', 3),
('5', 'DESPESAS', 'Despesas', 1),
('5.1', 'Custos dos Produtos Vendidos', 'Despesas', 2),
('5.2', 'Despesas Operacionais', 'Despesas', 2),
('5.2.1', 'Despesas Administrativas', 'Despesas', 3),
('5.2.2', 'Despesas Comerciais', 'Despesas', 3);

-- Insert default cost centers
INSERT INTO public.cost_centers (code, name, description) VALUES
('001', 'Produção', 'Centro de custo da área de produção'),
('002', 'Vendas', 'Centro de custo da área comercial'),
('003', 'Administrativo', 'Centro de custo da área administrativa'),
('004', 'Financeiro', 'Centro de custo da área financeira');

-- Function to update remaining amounts
CREATE OR REPLACE FUNCTION public.update_payable_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.accounts_payable 
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM public.payment_transactions 
      WHERE account_payable_id = NEW.account_payable_id
    ),
    remaining_amount = original_amount + interest_amount - discount_amount - (
      SELECT COALESCE(SUM(amount), 0) 
      FROM public.payment_transactions 
      WHERE account_payable_id = NEW.account_payable_id
    ),
    status = CASE 
      WHEN (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM public.payment_transactions 
        WHERE account_payable_id = NEW.account_payable_id
      )) <= 0 THEN 'Pago'
      WHEN due_date < CURRENT_DATE AND (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM public.payment_transactions 
        WHERE account_payable_id = NEW.account_payable_id
      )) > 0 THEN 'Vencido'
      ELSE 'Pendente'
    END,
    updated_at = now()
  WHERE id = NEW.account_payable_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_receivable_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.accounts_receivable 
  SET 
    received_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM public.receipt_transactions 
      WHERE account_receivable_id = NEW.account_receivable_id
    ),
    remaining_amount = original_amount + interest_amount - discount_amount - (
      SELECT COALESCE(SUM(amount), 0) 
      FROM public.receipt_transactions 
      WHERE account_receivable_id = NEW.account_receivable_id
    ),
    status = CASE 
      WHEN (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM public.receipt_transactions 
        WHERE account_receivable_id = NEW.account_receivable_id
      )) <= 0 THEN 'Recebido'
      WHEN due_date < CURRENT_DATE AND (original_amount + interest_amount - discount_amount - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM public.receipt_transactions 
        WHERE account_receivable_id = NEW.account_receivable_id
      )) > 0 THEN 'Vencido'
      ELSE 'Pendente'
    END,
    updated_at = now()
  WHERE id = NEW.account_receivable_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER trigger_update_payable_remaining_amount
AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_payable_remaining_amount();

CREATE TRIGGER trigger_update_receivable_remaining_amount
AFTER INSERT OR UPDATE OR DELETE ON public.receipt_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_receivable_remaining_amount();
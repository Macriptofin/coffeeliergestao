-- Criar tabela de colaboradores com campos padrão de mercado
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Dados Pessoais
  employee_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  rg TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('Masculino', 'Feminino', 'Outro', 'Prefiro não informar')),
  marital_status TEXT CHECK (marital_status IN ('Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável')),
  
  -- Contato
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Endereço
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Dados Profissionais
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  hire_date DATE NOT NULL,
  termination_date DATE,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('CLT', 'PJ', 'Estágio', 'Temporário', 'Terceirizado')) DEFAULT 'CLT',
  salary DECIMAL(10,2),
  benefits TEXT[], -- Array para benefícios
  
  -- Documentação
  pis_pasep TEXT,
  ctps_number TEXT, -- Carteira de Trabalho
  ctps_series TEXT,
  voter_registration TEXT, -- Título de eleitor
  military_service TEXT, -- Certificado militar
  
  -- Dados Bancários
  bank_name TEXT,
  bank_branch TEXT,
  bank_account TEXT,
  account_type TEXT CHECK (account_type IN ('Corrente', 'Poupança')),
  
  -- Status e Observações
  status TEXT NOT NULL CHECK (status IN ('Ativo', 'Inativo', 'Férias', 'Licença', 'Demitido')) DEFAULT 'Ativo',
  notes TEXT,
  
  -- Controle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso - apenas admins e managers podem gerenciar colaboradores
CREATE POLICY "Only admins and managers can view employees" 
ON public.employees 
FOR SELECT 
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert employees" 
ON public.employees 
FOR INSERT 
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update employees" 
ON public.employees 
FOR UPDATE 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete employees" 
ON public.employees 
FOR DELETE 
USING (is_admin_or_manager(auth.uid()));

-- Trigger para atualização automática de updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número de funcionário automaticamente
CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Buscar o próximo número para funcionários
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.employees 
  WHERE employee_number ~ '^FUNC[0-9]+$';
  
  -- Gerar número: FUNC0001
  new_number := 'FUNC' || LPAD(next_number::text, 4, '0');
  
  -- Só gerar se não foi fornecido
  IF NEW.employee_number IS NULL OR NEW.employee_number = '' THEN
    NEW.employee_number := new_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para gerar número do funcionário
CREATE TRIGGER generate_employee_number_trigger
BEFORE INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.generate_employee_number();

-- Criar índices para melhor performance
CREATE INDEX idx_employees_cpf ON public.employees(cpf);
CREATE INDEX idx_employees_department ON public.employees(department);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_hire_date ON public.employees(hire_date);
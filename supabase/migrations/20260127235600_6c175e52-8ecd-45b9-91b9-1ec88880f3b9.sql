-- Add client_type column to distinguish between individual (PF) and company (PJ)
ALTER TABLE public.clients 
ADD COLUMN client_type TEXT NOT NULL DEFAULT 'PJ' CHECK (client_type IN ('PF', 'PJ'));

-- Add comment for documentation
COMMENT ON COLUMN public.clients.client_type IS 'PF = Pessoa Física (individual), PJ = Pessoa Jurídica (company)';
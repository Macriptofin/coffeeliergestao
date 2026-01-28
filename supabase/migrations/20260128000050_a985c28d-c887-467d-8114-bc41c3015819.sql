-- Add fantasy_name column to clients table
ALTER TABLE public.clients 
ADD COLUMN fantasy_name TEXT;

-- Add comment to document the field
COMMENT ON COLUMN public.clients.fantasy_name IS 'Nome fantasia do cliente para exibição em listas (mais curto que razão social)';
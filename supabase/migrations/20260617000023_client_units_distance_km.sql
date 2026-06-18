-- Distância por UNIDADE: cada unidade do cliente tem endereço próprio (ex.: CMPC em
-- Guaíba, Porto Alegre, Barra do Ribeiro) → distância e frete diferentes por evento.
-- A distância do cliente (clients.distance_km) vira fallback p/ clientes sem unidades.
ALTER TABLE public.client_units ADD COLUMN IF NOT EXISTS distance_km numeric;

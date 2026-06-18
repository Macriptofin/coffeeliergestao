-- Local avulso do evento: para eventos em endereço que NÃO é uma unidade permanente
-- do cliente (ex.: salão alugado para um evento único). Alternativa ao unit_id.
-- A distância do frete resolve: local avulso → unidade selecionada → cliente.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS event_location_name        text,    -- nome/descrição do local avulso
  ADD COLUMN IF NOT EXISTS event_location_zip         text,    -- CEP do local avulso
  ADD COLUMN IF NOT EXISTS event_location_distance_km numeric; -- distância calculada do local avulso

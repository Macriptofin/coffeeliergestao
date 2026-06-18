-- Distância (km) da sede até o cliente — alimentada automaticamente no cadastro/
-- alteração de endereço (mesmo mecanismo dos fornecedores). Base p/ frete por evento.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS distance_km numeric;

-- Parâmetros globais de logística (frete por evento). nº de trajetos = 4 (2 idas +
-- 2 voltas: entrega/montagem + retorno p/ coleta); custo por km = R$ 1,50 (evoluirá
-- p/ TCO real do transporte). Configuráveis em Configurações > Precificação.
INSERT INTO public.app_settings (key, value) VALUES
  ('logistics.delivery_trips', '4'),
  ('logistics.cost_per_km',    '1.50')
ON CONFLICT (key) DO NOTHING;

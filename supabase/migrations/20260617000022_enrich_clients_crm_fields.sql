-- Enriquecimento do cadastro de cliente (base de CRM). Campos diretos (colunas
-- simples); múltiplos contatos/timeline/LTV ficam para a Fase 2 (tabelas próprias).
-- Obs.: a infraestrutura de contatos/departamentos/unidades/salas JÁ EXISTE
-- (client_contacts/client_departments/client_units/client_rooms) — estes campos
-- complementam o cabeçalho do cliente.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifecycle_stage     text,   -- Lead/Prospect/Ativo/Recorrente/Inativo
  ADD COLUMN IF NOT EXISTS lead_source         text,   -- origem (Indicação, Site, Evento, Prospecção, Outro)
  ADD COLUMN IF NOT EXISTS segment             text,   -- segmento/ramo
  ADD COLUMN IF NOT EXISTS classification      text,   -- VIP / A / B / C
  ADD COLUMN IF NOT EXISTS state_registration  text,   -- Inscrição Estadual (PJ)
  ADD COLUMN IF NOT EXISTS billing_email       text,   -- e-mail de faturamento (NF)
  ADD COLUMN IF NOT EXISTS payment_terms       text,   -- condição de pagamento padrão
  ADD COLUMN IF NOT EXISTS address_number      text,   -- número
  ADD COLUMN IF NOT EXISTS neighborhood        text,   -- bairro
  ADD COLUMN IF NOT EXISTS address_complement  text;   -- complemento

-- Reorganização da proposta em torno do MOMENTO (composição):
--  * proposals.event_name      → nome do evento guarda-chuva (cabeçalho)
--  * proposal_compositions.event_category → tipo de evento POR momento
-- Aditivas e nullable: não quebram nada existente. proposals.event_category passa a ser
-- legado (mantido sincronizado pelo editor como o tipo do 1º momento, p/ PDF/lista).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS event_name text;

ALTER TABLE public.proposal_compositions
  ADD COLUMN IF NOT EXISTS event_category text;

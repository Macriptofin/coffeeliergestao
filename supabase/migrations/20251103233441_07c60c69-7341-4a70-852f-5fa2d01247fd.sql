-- Criar tabela para sessões/agendas de eventos
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time VARCHAR(10),
  session_type VARCHAR(50),
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para melhorar performance de busca por evento
CREATE INDEX IF NOT EXISTS idx_event_sessions_event_id ON public.event_sessions(event_id);

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_event_sessions_date ON public.event_sessions(session_date);

-- Habilitar RLS
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (mesmas permissões dos eventos)
CREATE POLICY "Usuários podem ver sessões de eventos" 
ON public.event_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Usuários autenticados podem criar sessões" 
ON public.event_sessions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar sessões" 
ON public.event_sessions 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar sessões" 
ON public.event_sessions 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_event_sessions_updated_at
BEFORE UPDATE ON public.event_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.event_sessions IS 'Armazena múltiplas sessões/agendas de fornecimento para cada evento';
COMMENT ON COLUMN public.event_sessions.session_type IS 'Tipo da sessão: Manhã, Tarde, Noite, etc';
COMMENT ON COLUMN public.event_sessions.quantity IS 'Quantidade de pessoas para esta sessão específica';
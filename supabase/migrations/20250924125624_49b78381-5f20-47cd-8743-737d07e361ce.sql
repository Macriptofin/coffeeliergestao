-- Criar tabela de eventos
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  setup_time TIME,
  event_duration INTEGER DEFAULT 4, -- horas
  status TEXT NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Em Preparação', 'Em Andamento', 'Concluído', 'Cancelado')),
  venue TEXT, -- local do evento
  contact_person TEXT,
  contact_phone TEXT,
  total_people INTEGER NOT NULL,
  total_weight NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  setup_notes TEXT,
  special_requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de notificações de eventos
CREATE TABLE public.event_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('confirmacao', 'lista_compras', 'checklist', 'confirmacao_entrega', 'lembrete_final', 'setup')),
  trigger_date DATE NOT NULL,
  message TEXT NOT NULL,
  notification_method TEXT NOT NULL DEFAULT 'sistema' CHECK (notification_method IN ('email', 'sistema', 'whatsapp')),
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de checklist de eventos
CREATE TABLE public.event_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  responsible_person TEXT,
  due_date DATE NOT NULL,
  priority_level TEXT NOT NULL DEFAULT 'média' CHECK (priority_level IN ('baixa', 'média', 'alta', 'crítica')),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para events
CREATE POLICY "Only admins and managers can manage events" 
ON public.events 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Criar políticas RLS para event_notifications
CREATE POLICY "Only admins and managers can manage event_notifications" 
ON public.event_notifications 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Criar políticas RLS para event_checklist
CREATE POLICY "Only admins and managers can manage event_checklist" 
ON public.event_checklist 
FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Trigger para atualizar updated_at nas tabelas
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_checklist_updated_at
  BEFORE UPDATE ON public.event_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar evento automaticamente quando proposta for aprovada
CREATE OR REPLACE FUNCTION public.create_event_from_proposal()
RETURNS TRIGGER AS $$
BEGIN
  -- Só criar evento se status mudou para 'Aprovada'
  IF NEW.status = 'Aprovada' AND (OLD.status IS NULL OR OLD.status != 'Aprovada') THEN
    INSERT INTO public.events (
      proposal_id,
      client_id,
      event_name,
      event_date,
      total_people,
      total_weight,
      total_amount,
      event_duration
    ) VALUES (
      NEW.id,
      NEW.client_id,
      'Evento - Proposta ' || NEW.proposal_number,
      NEW.event_date,
      NEW.number_of_people,
      COALESCE(NEW.total_weight, 0),
      COALESCE(NEW.total_amount, 0),
      4 -- duração padrão de 4 horas
    );
    
    -- Criar notificações automáticas para o evento criado
    PERFORM public.create_event_notifications(
      (SELECT id FROM public.events WHERE proposal_id = NEW.id ORDER BY created_at DESC LIMIT 1)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar evento quando proposta for aprovada
CREATE TRIGGER create_event_on_proposal_approval
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_event_from_proposal();

-- Função para criar notificações automáticas de um evento
CREATE OR REPLACE FUNCTION public.create_event_notifications(p_event_id UUID)
RETURNS VOID AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Buscar dados do evento
  SELECT * INTO event_record FROM public.events WHERE id = p_event_id;
  
  IF event_record.id IS NOT NULL THEN
    -- Notificação 30 dias antes: Confirmação do evento
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'confirmacao',
      event_record.event_date - INTERVAL '30 days',
      'Confirmação necessária para o evento ' || event_record.event_name || ' em ' || event_record.event_date
    );
    
    -- Notificação 15 dias antes: Lista de compras
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'lista_compras',
      event_record.event_date - INTERVAL '15 days',
      'Preparar lista de compras para o evento ' || event_record.event_name
    );
    
    -- Notificação 7 dias antes: Checklist final
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'checklist',
      event_record.event_date - INTERVAL '7 days',
      'Revisar checklist final do evento ' || event_record.event_name
    );
    
    -- Notificação 3 dias antes: Confirmação de entrega
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'confirmacao_entrega',
      event_record.event_date - INTERVAL '3 days',
      'Confirmar detalhes de entrega para ' || event_record.event_name
    );
    
    -- Notificação 1 dia antes: Lembrete final
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'lembrete_final',
      event_record.event_date - INTERVAL '1 day',
      'Lembrete final: evento ' || event_record.event_name || ' amanhã'
    );
    
    -- Notificação no dia: Setup
    INSERT INTO public.event_notifications (event_id, notification_type, trigger_date, message)
    VALUES (
      p_event_id,
      'setup',
      event_record.event_date,
      'Dia do evento: ' || event_record.event_name || ' - Iniciar preparação'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Criar bucket para arquivos de eventos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-attachments',
  'event-attachments',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
);

-- Criar tabela de anexos de eventos
CREATE TABLE public.event_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('proposta', 'ordem_producao', 'contrato', 'checklist', 'outro')),
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para melhor performance
CREATE INDEX idx_event_attachments_event_id ON public.event_attachments(event_id);

-- Habilitar RLS
ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para event_attachments
CREATE POLICY "Admins and managers can view event attachments"
ON public.event_attachments
FOR SELECT
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can upload event attachments"
ON public.event_attachments
FOR INSERT
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can delete event attachments"
ON public.event_attachments
FOR DELETE
USING (is_admin_or_manager(auth.uid()));

-- Políticas RLS para storage - permitir admins e managers acessarem arquivos
CREATE POLICY "Admins and managers can view event files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'event-attachments' 
  AND (SELECT is_admin_or_manager(auth.uid()))
);

CREATE POLICY "Admins and managers can upload event files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-attachments' 
  AND (SELECT is_admin_or_manager(auth.uid()))
);

CREATE POLICY "Admins and managers can delete event files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'event-attachments' 
  AND (SELECT is_admin_or_manager(auth.uid()))
);
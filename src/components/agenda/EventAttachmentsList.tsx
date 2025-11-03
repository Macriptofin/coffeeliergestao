import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EventAttachmentsUpload } from './EventAttachmentsUpload';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  attachment_type: string;
  description: string | null;
  uploaded_at: string;
}

interface EventAttachmentsListProps {
  eventId: string;
}

export function EventAttachmentsList({ eventId }: EventAttachmentsListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadAttachments();
  }, [eventId]);

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('event_attachments')
        .select('*')
        .eq('event_id', eventId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Erro ao carregar anexos:', error);
      toast.error('Erro ao carregar anexos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('event-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      // Criar URL e fazer download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download iniciado!');
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('event-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Deletar do banco
      const { error: dbError } = await supabase
        .from('event_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      toast.success('Anexo excluído com sucesso!');
      loadAttachments();
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      toast.error('Erro ao excluir anexo');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      proposta: 'Proposta',
      ordem_producao: 'Ordem de Produção',
      contrato: 'Contrato',
      checklist: 'Checklist',
      outro: 'Outro'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      proposta: 'bg-blue-500',
      ordem_producao: 'bg-green-500',
      contrato: 'bg-purple-500',
      checklist: 'bg-yellow-500',
      outro: 'bg-gray-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="text-center py-4">Carregando anexos...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Anexos do Evento</span>
          {!showUpload && (
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Anexar Arquivo
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showUpload && (
          <div className="mb-4">
            <EventAttachmentsUpload
              eventId={eventId}
              onUploadSuccess={() => {
                setShowUpload(false);
                loadAttachments();
              }}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}

        {attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum arquivo anexado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <p className="font-medium truncate">{attachment.file_name}</p>
                    <Badge className={getTypeColor(attachment.attachment_type)}>
                      {getTypeLabel(attachment.attachment_type)}
                    </Badge>
                  </div>
                  {attachment.description && (
                    <p className="text-sm text-muted-foreground mb-1">{attachment.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {(attachment.file_size / 1024 / 1024).toFixed(2)} MB • 
                    Enviado em {format(new Date(attachment.uploaded_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(attachment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

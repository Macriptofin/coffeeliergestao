import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, FileText, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EventAttachmentsUpload } from './EventAttachmentsUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadAttachments();
  }, [eventId]);

  useEffect(() => {
    if (!previewOpen) {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    }
  }, [previewOpen, previewUrl]);

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

  const getSignedFileUrl = async (attachment: Attachment, download?: string | boolean) => {
    const { data, error } = await supabase.storage
      .from('event-attachments')
      .createSignedUrl(attachment.file_path, 3600, download ? { download } : undefined);

    if (error || !data?.signedUrl) {
      throw error ?? new Error('Não foi possível gerar o link do arquivo');
    }

    return data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${data.signedUrl}`;
  };

  const getAttachmentBlob = async (attachment: Attachment) => {
    const { data, error } = await supabase.storage
      .from('event-attachments')
      .download(attachment.file_path);

    if (!error && data) {
      return data.type
        ? data
        : new Blob([data], { type: attachment.file_type || 'application/octet-stream' });
    }

    const signedUrl = await getSignedFileUrl(attachment);
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw error ?? new Error(`Falha ao acessar arquivo (${response.status})`);
    }

    const blob = await response.blob();
    return blob.type
      ? blob
      : new Blob([blob], { type: attachment.file_type || 'application/octet-stream' });
  };

  const createLocalFileUrl = async (attachment: Attachment) => {
    const blob = await getAttachmentBlob(attachment);
    return URL.createObjectURL(blob);
  };

  const handlePreview = async (attachment: Attachment) => {
    setPreviewLoading(true);
    setPreviewName(attachment.file_name);
    setPreviewType(attachment.file_type);
    setPreviewOpen(true);

    try {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      const localUrl = await createLocalFileUrl(attachment);
      setPreviewUrl(localUrl);
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
      toast.error('Erro ao carregar visualização');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    let downloadWindow: Window | null = null;

    try {
      downloadWindow = window.open('', '_blank');
      if (downloadWindow) {
        downloadWindow.opener = null;
      }

      const signedUrl = await getSignedFileUrl(attachment, attachment.file_name);

      if (downloadWindow && !downloadWindow.closed) {
        downloadWindow.location.href = signedUrl;
      } else {
        const localUrl = await createLocalFileUrl(attachment);
        const a = document.createElement('a');
        a.href = localUrl;
        a.download = attachment.file_name;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(localUrl), 1500);
      }

      toast.success('Download iniciado!');
    } catch (error) {
      downloadWindow?.close();
      console.error('Erro ao fazer download:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('event-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

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

  const renderPreviewContent = () => {
    if (previewLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      );
    }

    if (!previewUrl) return null;

    if (previewType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
          <img
            src={previewUrl}
            alt={previewName}
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>
      );
    }

    if (previewType === 'application/pdf') {
      return (
        <div className="w-full h-[70vh] flex flex-col gap-2">
          <iframe
            src={`${previewUrl}#toolbar=1&navpanes=0`}
            className="w-full flex-1 border rounded"
            title={previewName}
          />
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
          </div>
        </div>
      );
    }

    if (previewType.startsWith('text/')) {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-[70vh] border rounded bg-white"
          title={previewName}
        />
      );
    }

    return (
      <div className="text-center py-8 text-muted-foreground">
        Tipo de arquivo não suportado para visualização
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-4">Carregando anexos...</div>;
  }

  return (
    <>
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
                    {canPreview(attachment.file_type) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(attachment)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(attachment)}
                      title="Excluir"
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewName}</DialogTitle>
          </DialogHeader>
          {renderPreviewContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface EventAttachmentsUploadProps {
  eventId: string;
  onUploadSuccess: () => void;
  onCancel: () => void;
}

export function EventAttachmentsUpload({ eventId, onUploadSuccess, onCancel }: EventAttachmentsUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<string>('outro');
  const [description, setDescription] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Verificar tamanho (50MB)
      if (selectedFile.size > 52428800) {
        toast.error('Arquivo muito grande! Tamanho máximo: 50MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo');
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Registrar na tabela
      const { error: dbError } = await supabase
        .from('event_attachments')
        .insert({
          event_id: eventId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          attachment_type: attachmentType,
          description: description || null,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;

      toast.success('Arquivo anexado com sucesso!');
      onUploadSuccess();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao anexar arquivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Anexar Arquivo</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo *</Label>
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachment_type">Tipo de Documento *</Label>
          <Select value={attachmentType} onValueChange={setAttachmentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proposta">Proposta</SelectItem>
              <SelectItem value="ordem_producao">Ordem de Produção</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="checklist">Checklist</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional do arquivo..."
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Anexar Arquivo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

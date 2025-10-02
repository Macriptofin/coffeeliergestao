import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Edit } from 'lucide-react';
import { useInvoiceOCR } from '@/hooks/useInvoiceOCR';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InvoiceEditDialog } from './InvoiceEditDialog';

interface InvoiceOCRUploaderProps {
  onCreated?: () => void;
}

export const InvoiceOCRUploader = ({ onCreated }: InvoiceOCRUploaderProps) => {
  const { loading, invoiceData, processInvoice, clearData } = useInvoiceOCR();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      clearData();
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    await processInvoice(selectedFile);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    clearData();
  };

  const handleEditClick = () => {
    setIsEditDialogOpen(true);
  };

  const handleLaunch = async () => {
    // Fechar e limpar
    setIsEditDialogOpen(false);
    clearData();
    handleReset();
    // Notificar o pai para recarregar a lista
    onCreated?.();
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            OCR de Nota Fiscal
          </CardTitle>
          <CardDescription>
            Faça upload da imagem da nota fiscal para extração automática dos dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Selecione uma imagem da nota fiscal (JPG, PNG)
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="max-w-xs mx-auto"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleProcess}
                    disabled={loading}
                    size="sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Processar Nota'
                    )}
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              {previewUrl && (
                <div className="border rounded-lg p-4">
                  <img 
                    src={previewUrl} 
                    alt="Preview da nota fiscal" 
                    className="max-h-64 mx-auto object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {invoiceData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Dados Extraídos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fornecedor</label>
                <p className="text-lg font-semibold">{invoiceData.fornecedor}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data</label>
                <p className="text-lg font-semibold">
                  {new Date(invoiceData.data).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {invoiceData.numero_nota && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Número NF</label>
                  <p className="text-lg font-semibold">{invoiceData.numero_nota}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">
                Itens ({invoiceData.itens.length})
              </h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Material Sugerido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceData.itens.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell className="text-right">
                          R$ {item.preco_unitario.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {item.preco_total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.material_sugerido_nome ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {item.material_sugerido_nome}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Não encontrado
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total da Nota:</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {invoiceData.itens.reduce((sum, item) => sum + item.preco_total, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleEditClick}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar e Lançar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoiceEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        invoiceData={invoiceData}
        onLaunch={handleLaunch}
      />
    </div>
  );
};

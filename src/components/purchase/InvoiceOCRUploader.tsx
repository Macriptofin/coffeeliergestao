import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Edit } from 'lucide-react';
import { useInvoiceOCR } from '@/hooks/useInvoiceOCR';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const InvoiceOCRUploader = () => {
  const { loading, invoiceData, processInvoice, clearData } = useInvoiceOCR();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);

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
    setEditedData(JSON.parse(JSON.stringify(invoiceData))); // Deep copy
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    // Atualizar os dados com as edições
    if (editedData) {
      // Aqui você pode atualizar o invoiceData no hook se necessário
      // Por enquanto, apenas fechar o diálogo
      setIsEditDialogOpen(false);
    }
  };

  const updateItemField = (index: number, field: string, value: any) => {
    if (!editedData) return;
    const newData = { ...editedData };
    newData.itens[index][field] = value;
    
    // Recalcular preço total se quantidade ou preço unitário mudar
    if (field === 'quantidade' || field === 'preco_unitario') {
      newData.itens[index].preco_total = 
        parseFloat(newData.itens[index].quantidade) * 
        parseFloat(newData.itens[index].preco_unitario);
    }
    
    setEditedData(newData);
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
              <Button className="flex-1">
                Criar Nota Fiscal
              </Button>
              <Button variant="outline" onClick={handleEditClick}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Dados da Nota Fiscal</DialogTitle>
            <DialogDescription>
              Faça as correções necessárias nos dados extraídos
            </DialogDescription>
          </DialogHeader>

          {editedData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    value={editedData.fornecedor}
                    onChange={(e) => setEditedData({ ...editedData, fornecedor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={editedData.data}
                    onChange={(e) => setEditedData({ ...editedData, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_nota">Número NF</Label>
                  <Input
                    id="numero_nota"
                    value={editedData.numero_nota || ''}
                    onChange={(e) => setEditedData({ ...editedData, numero_nota: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Itens da Nota</h3>
                {editedData.itens.map((item: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Nome do Item</Label>
                          <Input
                            value={item.nome}
                            onChange={(e) => updateItemField(idx, 'nome', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade}
                            onChange={(e) => updateItemField(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidade</Label>
                          <Input
                            value={item.unidade}
                            onChange={(e) => updateItemField(idx, 'unidade', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Preço Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.preco_unitario}
                            onChange={(e) => updateItemField(idx, 'preco_unitario', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="mt-4 text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="font-semibold">R$ {item.preco_total.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Geral:</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {editedData.itens.reduce((sum: number, item: any) => sum + item.preco_total, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

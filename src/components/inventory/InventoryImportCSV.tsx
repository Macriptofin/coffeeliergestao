import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Check, X, Edit2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CSVRow {
  nome: string;
  codigo?: string;
  quantidade: string;
  unidade_compra: string;
  unidade_uso: string;
  categoria?: string;
  subcategoria?: string;
  tipo_material?: string;
  observacoes?: string;
}

interface MatchedItem {
  csvData: CSVRow;
  matchedMaterial?: {
    id: string;
    name: string;
    code: string;
    usage_unit: string;
    material_type: string;
    current_stock?: number;
  };
  action: 'adjust' | 'create';
  status: 'pending' | 'confirmed' | 'editing';
  editData?: Partial<CSVRow>;
}

export const InventoryImportCSV = () => {
  const [file, setFile] = useState<File | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [editingItem, setEditingItem] = useState<MatchedItem | null>(null);

  const downloadTemplate = () => {
    const template = [
      ['TEMPLATE DE INVENTÁRIO FÍSICO - FORMATO A4'],
      ['Preencha as colunas abaixo com os dados do inventário físico'],
      ['unidade_compra: unidade em que o material é comprado (ex: kg, pacote, caixa)'],
      ['unidade_uso: unidade usada nas receitas/produção (ex: g, ml, un)'],
      [''],
      ['nome', 'codigo', 'quantidade', 'unidade_compra', 'unidade_uso', 'categoria', 'subcategoria', 'tipo_material', 'observacoes'],
      ['Café Especial Bourbon', 'CAF001', '25', 'kg', 'g', 'Matéria Prima', 'Cafés', 'ingredient', 'Lote 2024-01'],
    ];

    // Adicionar 60 linhas em branco para preenchimento manual
    for (let i = 0; i < 60; i++) {
      template.push(['', '', '', '', '', '', '', '', '']);
    }

    const csv = template.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Template baixado com sucesso!');
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Pula linhas de cabeçalho/instruções até encontrar a linha com "nome"
    let headerIndex = lines.findIndex(line => line.toLowerCase().includes('nome'));
    if (headerIndex === -1) headerIndex = 0;
    
    const headers = lines[headerIndex].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVRow[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 3) continue; // Pula linhas incompletas
      
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      if (row.nome) {
        rows.push(row as CSVRow);
      }
    }

    return rows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const text = await uploadedFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('Nenhum dado válido encontrado no arquivo');
        return;
      }

      // Buscar materiais existentes
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, material_type');

      if (materialsError) throw materialsError;

      // Buscar estoque atual via stock_movements agregado
      const materialIds = materials?.map(m => m.id) || [];
      let stockMap: Record<string, number> = {};

      if (materialIds.length > 0) {
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('material_id, quantity, movement_type')
          .in('material_id', materialIds);

        // Calcular estoque atual por material
        movements?.forEach(mov => {
          if (!stockMap[mov.material_id]) stockMap[mov.material_id] = 0;
          const qty = mov.movement_type === 'out' ? -mov.quantity : mov.quantity;
          stockMap[mov.material_id] += qty;
        });
      }

      // Fazer matching
      const matched: MatchedItem[] = rows.map(row => {
        const material = materials?.find(m => 
          m.code?.toLowerCase() === row.codigo?.toLowerCase() ||
          m.name.toLowerCase() === row.nome.toLowerCase()
        );

        return {
          csvData: row,
          matchedMaterial: material ? {
            id: material.id,
            name: material.name,
            code: material.code,
            usage_unit: material.usage_unit,
            material_type: material.material_type,
            current_stock: stockMap[material.id] || 0
          } : undefined,
          action: material ? 'adjust' : 'create',
          status: 'pending'
        };
      });

      setMatchedItems(matched);
      setShowReview(true);
      toast.success(`${rows.length} itens carregados para revisão`);
    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmItem = (index: number) => {
    setMatchedItems(items => 
      items.map((item, i) => 
        i === index ? { ...item, status: 'confirmed' as const } : item
      )
    );
  };

  const handleEditItem = (item: MatchedItem) => {
    setEditingItem({ ...item, editData: { ...item.csvData } });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    setMatchedItems(items =>
      items.map(item =>
        item === editingItem
          ? { ...item, csvData: { ...item.csvData, ...item.editData }, status: 'confirmed' as const }
          : item
      )
    );
    setEditingItem(null);
  };

  const handleProcessAll = async () => {
    const confirmedItems = matchedItems.filter(item => item.status === 'confirmed');
    
    if (confirmedItems.length === 0) {
      toast.error('Nenhum item confirmado para processar');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let successCount = 0;
      let errorCount = 0;

      for (const item of confirmedItems) {
        try {
          if (item.action === 'create') {
            // Criar novo material
            const { data: newMaterial, error: materialError } = await supabase
              .from('materials')
              .insert({
                name: item.csvData.nome,
                code: item.csvData.codigo || null,
                purchase_unit: item.csvData.unidade_compra,
                usage_unit: item.csvData.unidade_uso,
                conversion_factor: 1,
                price_per_purchase_unit: 0,
                category: item.csvData.categoria || 'Sem Categoria',
                subcategory: item.csvData.subcategoria || null,
                material_type: (item.csvData.tipo_material as any) || 'ingredient',
              })
              .select()
              .single();

            if (materialError) throw materialError;

            // Registrar entrada inicial de estoque
            const quantity = parseFloat(item.csvData.quantidade);
            const unitPrice = 0;
            await supabase.from('stock_movements').insert({
              material_id: newMaterial.id,
              movement_type: 'in',
              quantity,
              unit: item.csvData.unidade_uso,
              unit_price: unitPrice,
              total_cost: quantity * unitPrice,
              notes: `Inventário inicial - ${item.csvData.observacoes || 'Importação CSV'}`,
              responsible_user_id: user.id,
            });

          } else {
            // Ajustar estoque existente
            const newQty = parseFloat(item.csvData.quantidade);
            const oldQty = item.matchedMaterial?.current_stock || 0;
            const diff = newQty - oldQty;

            if (diff !== 0) {
              const adjustQuantity = Math.abs(diff);
              const unitPrice = 0;
              await supabase.from('stock_movements').insert({
                material_id: item.matchedMaterial!.id,
                movement_type: 'inventory_adjustment',
                quantity: adjustQuantity,
                unit: item.matchedMaterial!.usage_unit,
                unit_price: unitPrice,
                total_cost: adjustQuantity * unitPrice,
                notes: `Ajuste de inventário: ${oldQty} → ${newQty}${item.csvData.observacoes ? ` - ${item.csvData.observacoes}` : ''}`,
                responsible_user_id: user.id,
              });
            }
          }

          successCount++;
        } catch (error) {
          console.error('Erro ao processar item:', item.csvData.nome, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} itens processados com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} itens com erro`);
      }

      // Limpar estado
      setFile(null);
      setMatchedItems([]);
      setShowReview(false);

    } catch (error) {
      console.error('Erro ao processar inventário:', error);
      toast.error('Erro ao processar inventário');
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = matchedItems.filter(i => i.status === 'pending').length;
  const confirmedCount = matchedItems.filter(i => i.status === 'confirmed').length;
  const createCount = matchedItems.filter(i => i.action === 'create').length;
  const adjustCount = matchedItems.filter(i => i.action === 'adjust').length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importação de Inventário CSV
          </CardTitle>
          <CardDescription>
            Faça download do template, preencha com os dados do inventário físico e importe para processar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Download Template */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
              Baixar Template
            </h3>
            <Button onClick={downloadTemplate} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Download Template CSV
            </Button>
            <p className="text-sm text-muted-foreground">
              O template contém as colunas necessárias e exemplos de preenchimento
            </p>
          </div>

          {/* Step 2: Upload File */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
              Upload do Arquivo Preenchido
            </h3>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                📄 {file.name}
              </p>
            )}
          </div>

          {/* Summary */}
          {matchedItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{matchedItems.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criar Novos</p>
                <p className="text-2xl font-bold text-green-600">{createCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ajustar</p>
                <p className="text-2xl font-bold text-blue-600">{adjustCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confirmados</p>
                <p className="text-2xl font-bold">{confirmedCount}/{matchedItems.length}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {showReview && (
            <div className="flex gap-2">
              <Button
                onClick={handleProcessAll}
                disabled={confirmedCount === 0 || isProcessing}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Processar {confirmedCount} Itens Confirmados
              </Button>
              <Button
                onClick={() => {
                  setShowReview(false);
                  setMatchedItems([]);
                  setFile(null);
                }}
                variant="outline"
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Table */}
      {showReview && matchedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisão de Itens</CardTitle>
            <CardDescription>
              Confira os dados antes de processar. Materiais em verde serão criados, em azul terão estoque ajustado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead>Un. Compra</TableHead>
                    <TableHead>Un. Uso</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedItems.map((item, index) => (
                    <TableRow key={index} className={item.status === 'confirmed' ? 'bg-green-50' : ''}>
                      <TableCell>
                        {item.status === 'confirmed' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.action === 'create' ? 'default' : 'secondary'}>
                          {item.action === 'create' ? 'Criar' : 'Ajustar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.csvData.nome}</TableCell>
                      <TableCell>{item.csvData.codigo || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{item.csvData.quantidade}</TableCell>
                      <TableCell>{item.csvData.unidade_compra}</TableCell>
                      <TableCell>{item.csvData.unidade_uso}</TableCell>
                      <TableCell className="text-sm">{item.csvData.categoria || '-'}</TableCell>
                      <TableCell>
                        {item.matchedMaterial ? (
                          <div className="text-xs">
                            <div className="font-medium">{item.matchedMaterial.name}</div>
                            <div className="text-muted-foreground">
                              Atual: {item.matchedMaterial.current_stock} {item.matchedMaterial.usage_unit}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Novo material</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {item.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConfirmItem(index)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>
              Ajuste os dados antes de confirmar o item
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nome do Material</Label>
                <Input
                  value={editingItem.editData?.nome || editingItem.csvData.nome}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    editData: { ...editingItem.editData, nome: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Código</Label>
                  <Input
                    value={editingItem.editData?.codigo || editingItem.csvData.codigo || ''}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, codigo: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de Material</Label>
                  <Select
                    value={editingItem.editData?.tipo_material || editingItem.csvData.tipo_material || 'ingredient'}
                    onValueChange={(value) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, tipo_material: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingredient">Ingrediente</SelectItem>
                      <SelectItem value="packaging">Embalagem</SelectItem>
                      <SelectItem value="intermediate_product">Produto Intermediário</SelectItem>
                      <SelectItem value="finished_product">Produto Acabado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingItem.editData?.quantidade || editingItem.csvData.quantidade}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, quantidade: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade de Compra</Label>
                  <Input
                    value={editingItem.editData?.unidade_compra || editingItem.csvData.unidade_compra}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, unidade_compra: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade de Uso</Label>
                  <Input
                    value={editingItem.editData?.unidade_uso || editingItem.csvData.unidade_uso}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, unidade_uso: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <Input
                    value={editingItem.editData?.categoria || editingItem.csvData.categoria || ''}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, categoria: e.target.value }
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Subcategoria</Label>
                  <Input
                    value={editingItem.editData?.subcategoria || editingItem.csvData.subcategoria || ''}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      editData: { ...editingItem.editData, subcategoria: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Observações</Label>
                <Textarea
                  value={editingItem.editData?.observacoes || editingItem.csvData.observacoes || ''}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    editData: { ...editingItem.editData, observacoes: e.target.value }
                  })}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit}>
                  Salvar e Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

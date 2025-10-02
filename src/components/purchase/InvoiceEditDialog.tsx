import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, AlertTriangle, Banknote, Smartphone, CreditCard, FileText, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupplierMatcher } from './SupplierMatcher';
import { InvoiceItemMatcher } from './InvoiceItemMatcher';
import { MaterialQuickCreate } from './MaterialQuickCreate';

interface InvoiceItem {
  nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  material_id?: string | null;
  material_nome?: string | null;
  material_codigo?: string | null;
  status?: 'matched' | 'not_found' | 'pending';
  conversion_factor?: number;
  usage_unit?: string;
  converted_quantity?: number;
  converted_unit_price?: number;
  match_confidence?: number;
  match_method?: string;
}

interface InvoiceData {
  fornecedor: string;
  data: string;
  numero_nota?: string;
  itens: InvoiceItem[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface InvoiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceData: InvoiceData | null;
  onLaunch: () => void;
  supplierId?: string | null;
  formaPagamento?: string;
  numeroParcelas?: number;
  prazoPagamentoDias?: number;
  responsavelId?: string | null;
  observacoes?: string;
}

export const InvoiceEditDialog = ({
  open,
  onOpenChange,
  invoiceData,
  onLaunch,
  supplierId: initialSupplierId,
  formaPagamento: initialFormaPagamento,
  numeroParcelas: initialNumeroParcelas,
  prazoPagamentoDias: initialPrazoPagamentoDias,
  responsavelId: initialResponsavelId,
  observacoes: initialObservacoes
}: InvoiceEditDialogProps) => {
  const [editedData, setEditedData] = useState<InvoiceData | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId || null);
  const [formaPagamento, setFormaPagamento] = useState(initialFormaPagamento || '');
  const [numeroParcelas, setNumeroParcelas] = useState(initialNumeroParcelas || 1);
  const [prazoPagamentoDias, setPrazoPagamentoDias] = useState(initialPrazoPagamentoDias || 30);
  const [responsavelId, setResponsavelId] = useState<string | null>(initialResponsavelId || null);
  const [observacoes, setObservacoes] = useState(initialObservacoes || '');
  const [users, setUsers] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [launching, setLaunching] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateItemIndex, setQuickCreateItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (invoiceData && open) {
      setEditedData(JSON.parse(JSON.stringify(invoiceData)));
      loadUsers();
      
      // Inicializar itens com status
      const itemsWithStatus: InvoiceItem[] = invoiceData.itens.map(item => ({
        ...item,
        status: (item.material_id ? 'matched' : 'pending') as 'matched' | 'not_found' | 'pending'
      }));
      setEditedData({ ...invoiceData, itens: itemsWithStatus });
    }
  }, [invoiceData, open]);

  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, email')
        .limit(50);
      
      setUsers(data || []);
      
      // Auto-selecionar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setResponsavelId(user.id);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleMaterialSelect = async (itemIndex: number, materialId: string) => {
    if (!editedData) return;

    // Buscar dados do material
    const { data: material } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (!material) return;

    const item = editedData.itens[itemIndex];
    const conversionFactor = material.conversion_factor || 1;
    const convertedQty = item.quantidade * conversionFactor;
    const convertedPrice = item.preco_unitario / conversionFactor;

    const newItems = [...editedData.itens];
    newItems[itemIndex] = {
      ...item,
      material_id: materialId,
      material_nome: material.name,
      material_codigo: material.code,
      status: 'matched',
      match_method: 'manual',
      conversion_factor: conversionFactor,
      usage_unit: material.usage_unit,
      converted_quantity: convertedQty,
      converted_unit_price: convertedPrice
    };

    setEditedData({ ...editedData, itens: newItems });
  };

  const handleCreateNew = (itemIndex: number) => {
    setQuickCreateItemIndex(itemIndex);
    setQuickCreateOpen(true);
  };

  const handleQuickCreateSuccess = (materialId: string) => {
    if (quickCreateItemIndex !== null) {
      handleMaterialSelect(quickCreateItemIndex, materialId);
    }
  };

  const validateInvoice = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!supplierId) {
      errors.push({
        field: 'fornecedor',
        message: 'Fornecedor não selecionado',
        severity: 'error'
      });
    }

    if (!formaPagamento) {
      errors.push({
        field: 'forma_pagamento',
        message: 'Forma de pagamento não selecionada',
        severity: 'error'
      });
    }

    if (!responsavelId) {
      errors.push({
        field: 'responsavel',
        message: 'Responsável não selecionado',
        severity: 'error'
      });
    }

    const unmatchedItems = editedData?.itens.filter(i => !i.material_id) || [];
    if (unmatchedItems.length > 0) {
      errors.push({
        field: 'itens',
        message: `${unmatchedItems.length} ${unmatchedItems.length === 1 ? 'item' : 'itens'} sem material vinculado`,
        severity: 'error'
      });
    }

    if (!observacoes) {
      errors.push({
        field: 'observacoes',
        message: 'Considere adicionar observações sobre esta compra',
        severity: 'warning'
      });
    }

    return errors;
  };

  const handleLaunch = async () => {
    const errors = validateInvoice();
    setValidationErrors(errors);

    const criticalErrors = errors.filter(e => e.severity === 'error');
    if (criticalErrors.length > 0) {
      toast({
        title: 'Corrija os erros',
        description: 'Corrija os erros antes de lançar a nota fiscal',
        variant: 'destructive'
      });
      return;
    }

    if (!editedData || !supplierId || !responsavelId) return;

    setLaunching(true);

    try {
      // Buscar nome do fornecedor
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('company_name')
        .eq('id', supplierId)
        .single();

      const fornecedorNome = supplier?.company_name || editedData.fornecedor;

      // Criar registro da nota fiscal
      const { data: invoiceRecord, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: editedData.numero_nota,
          supplier_id: supplierId,
          invoice_date: new Date(editedData.data).toISOString().split('T')[0],
          total_amount: editedData.itens.reduce((sum, item) => sum + item.preco_total, 0),
          payment_method: formaPagamento,
          responsible_user_id: responsavelId,
          notes: observacoes,
          stock_posted: true  // Mudado de 'status' para 'stock_posted'
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Erro ao criar nota fiscal:', invoiceError);
        throw new Error('Erro ao criar registro da nota fiscal');
      }

      // Criar itens da nota fiscal
      const invoiceItemsData = editedData.itens.map(item => ({
        invoice_id: invoiceRecord.id,
        material_id: item.material_id,
        quantity: item.quantidade,
        unit_price: item.preco_unitario,
        total_price: item.preco_total
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) {
        console.error('Erro ao criar itens da nota:', itemsError);
        throw new Error('Erro ao criar itens da nota fiscal');
      }

      // Processar cada item
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < editedData.itens.length; i++) {
        const item = editedData.itens[i];
        
        if (!item.material_id) {
          errorCount++;
          continue;
        }

        try {
          // Criar entrada de estoque para cada item
          const { error: stockError } = await supabase
            .from('stock_movements')
            .insert({
              material_id: item.material_id,
              movement_type: 'Entrada',
              quantity: item.converted_quantity || item.quantidade,
              reference_type: 'Compra',
              reference_id: invoiceRecord.id,
              notes: `NF ${editedData.numero_nota || 'S/N'} - ${fornecedorNome} - ${item.nome}`
            });

          if (stockError) throw stockError;

          // Atualizar stock_items
          const { data: stockItem } = await supabase
            .from('stock_items')
            .select('*')
            .eq('material_id', item.material_id)
            .maybeSingle();

          const newQuantity = (stockItem?.current_quantity || 0) + (item.converted_quantity || item.quantidade);
          const newTotalValue = (stockItem?.total_value || 0) + item.preco_total;
          const newAverage = newTotalValue / newQuantity;

          if (stockItem) {
            await supabase
              .from('stock_items')
              .update({
                current_quantity: newQuantity,
                average_price: newAverage,
                total_value: newTotalValue,
                last_movement_date: new Date().toISOString()
              })
              .eq('material_id', item.material_id);
          } else {
            await supabase
              .from('stock_items')
              .insert({
                material_id: item.material_id,
                current_quantity: newQuantity,
                average_price: newAverage,
                total_value: newTotalValue,
                minimum_quantity: 0
              });
          }

          successCount++;
          
          toast({
            title: `✅ ${item.nome}`,
            description: 'Item lançado com sucesso',
            duration: 1000
          });

        } catch (itemError) {
          console.error(`Erro ao lançar item ${item.nome}:`, itemError);
          errorCount++;
          
          toast({
            title: `❌ ${item.nome}`,
            description: 'Erro ao lançar item',
            variant: 'destructive',
            duration: 2000
          });
        }
      }

      // Mostrar resultado final
      if (errorCount === 0) {
        toast({
          title: '🎉 Sucesso!',
          description: `Nota fiscal lançada! ${successCount} ${successCount === 1 ? 'item processado' : 'itens processados'}.`
        });
        
        onOpenChange(false);
        onLaunch();
        
      } else if (successCount > 0) {
        toast({
          title: '⚠️ Parcialmente OK',
          description: `${successCount} ${successCount === 1 ? 'item lançado' : 'itens lançados'}, ${errorCount} com erro.`,
          variant: 'default'
        });
        
      } else {
        toast({
          title: '❌ Erro',
          description: 'Nenhum item foi lançado. Verifique os erros.',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Erro ao lançar nota fiscal:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao lançar nota fiscal',
        variant: 'destructive'
      });
    } finally {
      setLaunching(false);
    }
  };

  const ValidationAlert = ({ errors }: { errors: ValidationError[] }) => {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    
    if (errors.length === 0) return null;
    
    return (
      <Alert variant={errorCount > 0 ? 'destructive' : 'default'}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {errorCount > 0 ? 'Corrija os erros antes de lançar' : 'Atenção'}
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className={
                error.severity === 'error' ? 'text-destructive' : 'text-yellow-600'
              }>
                {error.message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  };

  if (!editedData) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar e Lançar Nota Fiscal</DialogTitle>
            <DialogDescription>
              Complete as informações e vincule os materiais antes de lançar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Cabeçalho da Nota */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={editedData.data}
                  onChange={(e) => setEditedData({ ...editedData, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número NF</Label>
                <Input
                  value={editedData.numero_nota || ''}
                  onChange={(e) => setEditedData({ ...editedData, numero_nota: e.target.value })}
                />
              </div>
            </div>

            {/* Fornecedor */}
            <SupplierMatcher
              supplierText={editedData.fornecedor}
              selectedSupplierId={supplierId}
              onSupplierSelect={setSupplierId}
              onCreateNew={() => {
                toast({
                  title: 'Em desenvolvimento',
                  description: 'Cadastro rápido de fornecedor será implementado em breve'
                });
              }}
            />

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label>Forma de Pagamento *</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className={!formaPagamento ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      <span>Dinheiro</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pix">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      <span>PIX</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cartao_debito">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Cartão de Débito</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cartao_credito">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Cartão de Crédito</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="boleto">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Boleto</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="prazo">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>A Prazo</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formaPagamento === 'cartao_credito' || formaPagamento === 'prazo') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(parseInt(e.target.value))}
                  />
                </div>
                {formaPagamento === 'prazo' && (
                  <div className="space-y-2">
                    <Label>Prazo (dias)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={prazoPagamentoDias}
                      onChange={(e) => setPrazoPagamentoDias(parseInt(e.target.value))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Responsável */}
            <div className="space-y-2">
              <Label>Responsável pela Compra *</Label>
              <Select value={responsavelId || ''} onValueChange={setResponsavelId}>
                <SelectTrigger className={!responsavelId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.display_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre esta compra..."
                rows={3}
              />
            </div>

            {/* Itens */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Itens da Nota ({editedData.itens.length})</h3>
              {editedData.itens.map((item, idx) => (
                <InvoiceItemMatcher
                  key={idx}
                  item={item}
                  index={idx}
                  onMaterialSelect={handleMaterialSelect}
                  onCreateNew={handleCreateNew}
                />
              ))}
            </div>

            {/* Total */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total da Nota:</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {editedData.itens.reduce((sum, item) => sum + item.preco_total, 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Validação */}
            {validationErrors.length > 0 && (
              <ValidationAlert errors={validationErrors} />
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={launching}>
              Cancelar
            </Button>
            <Button onClick={handleLaunch} disabled={launching}>
              {launching ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lançando...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Criar Nota Fiscal</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de cadastro rápido */}
      {quickCreateItemIndex !== null && (
        <MaterialQuickCreate
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          itemName={editedData.itens[quickCreateItemIndex].nome}
          purchaseUnit={editedData.itens[quickCreateItemIndex].unidade}
          onSuccess={handleQuickCreateSuccess}
        />
      )}
    </>
  );
};

import { useState, useEffect } from 'react';
import { todayLocalISO, addDaysLocalISO } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, AlertTriangle, Banknote, Smartphone, CreditCard, FileText, Calendar, Save, Percent, DollarSign, Lock, Unlock, Truck, Plus, Trash2 } from 'lucide-react';
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
  desconto?: number;
  desconto_percentual?: number;
  preco_com_desconto?: number;
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
  // Campos fiscais
  ncm?: string;
  cst?: string;
  cfop?: string;
  icms_base?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  icms_st_base?: number;
  icms_st_valor?: number;
  ipi_valor?: number;
  ipi_aliquota?: number;
}

interface InvoiceData {
  fornecedor: string;
  data: string;
  numero_nota?: string;
  itens: InvoiceItem[];
  discount_total?: number;
  discount_type?: 'value' | 'percent';
  // Totalizadores fiscais
  icms_total?: number;
  icms_st_total?: number;
  ipi_total?: number;
  tributos_aprox_valor?: number;
  tributos_aprox_percent?: number;
  natureza_operacao?: string;
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
  onSaveDraft?: () => void;
  supplierId?: string | null;
  formaPagamento?: string;
  numeroParcelas?: number;
  prazoPagamentoDias?: number;
  responsavelId?: string | null;
  observacoes?: string;
  invoiceId?: string | null;
  isEditMode?: boolean;
  itemsLocked?: boolean;
  isAdmin?: boolean;
  /** Pedido de Compra de origem, quando a NF está sendo lançada a partir de um pedido aprovado. */
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
}

export const InvoiceEditDialog = ({
  open,
  onOpenChange,
  invoiceData,
  onLaunch,
  onSaveDraft,
  supplierId: initialSupplierId,
  formaPagamento: initialFormaPagamento,
  numeroParcelas: initialNumeroParcelas,
  prazoPagamentoDias: initialPrazoPagamentoDias,
  responsavelId: initialResponsavelId,
  observacoes: initialObservacoes,
  invoiceId,
  isEditMode = false,
  itemsLocked = false,
  isAdmin = false,
  purchaseOrderId = null,
  purchaseOrderNumber = null
}: InvoiceEditDialogProps) => {
  const [editedData, setEditedData] = useState<InvoiceData | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId || null);
  const [formaPagamento, setFormaPagamento] = useState(initialFormaPagamento || '');
  const [statusPagamento, setStatusPagamento] = useState<'pago' | 'a_vencer'>('a_vencer');
  const [dataPagamento, setDataPagamento] = useState(todayLocalISO());
  const [dataVencimento, setDataVencimento] = useState(
    addDaysLocalISO(30)
  );
  const [numeroParcelas, setNumeroParcelas] = useState(initialNumeroParcelas || 1);
  const [prazoPagamentoDias, setPrazoPagamentoDias] = useState(initialPrazoPagamentoDias || 30);
  const [responsavelId, setResponsavelId] = useState<string | null>(initialResponsavelId || null);
  const [observacoes, setObservacoes] = useState(initialObservacoes || '');
  const [users, setUsers] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [launching, setLaunching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateItemIndex, setQuickCreateItemIndex] = useState<number | null>(null);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [freightAmount, setFreightAmount] = useState(0);
  const [freightCostCenterId, setFreightCostCenterId] = useState<string | null>(null);
  
  const canEditItems = !itemsLocked || isAdmin;

  useEffect(() => {
    if (invoiceData && open) {
      loadUsers();
      loadCostCenters();

      // Inicializar itens com status
      const itemsWithStatus: InvoiceItem[] = invoiceData.itens.map(item => ({
        ...item,
        status: (item.material_id ? 'matched' : 'pending') as 'matched' | 'not_found' | 'pending'
      }));
      setEditedData({ ...invoiceData, itens: itemsWithStatus });

      // Restaurar desconto global e tipo (preserva rascunho salvo)
      if (invoiceData.discount_total != null) setDiscountTotal(invoiceData.discount_total);
      if (invoiceData.discount_type) setDiscountType(invoiceData.discount_type);

      // Re-sincronizar fornecedor com o prop — o componente não desmonta entre
      // aberturas, então o useState inicial não reflete um supplierId novo
      setSupplierId(initialSupplierId || null);
    }
  }, [invoiceData, open, initialSupplierId]);

  const loadCostCenters = async () => {
    try {
      const { data } = await supabase
        .from('cost_centers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      setCostCenters(data || []);
      
      // Auto-selecionar centro de custo de frete se existir
      const freightCC = data?.find(cc => 
        cc.name.toLowerCase().includes('frete') || 
        cc.name.toLowerCase().includes('logística') ||
        cc.name.toLowerCase().includes('entrega')
      );
      if (freightCC) {
        setFreightCostCenterId(freightCC.id);
      }
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
    }
  };

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

    const { data: material } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (!material) return;

    const item = editedData.itens[itemIndex];
    const conversionFactor = material.conversion_factor || 1;
    const convertedQty = item.quantidade * conversionFactor;

    // Preço com desconto se disponível
    const precoComDescontoUnit = item.preco_com_desconto
      ? item.preco_com_desconto / item.quantidade
      : item.preco_unitario;

    // IPI é um custo real (não recuperável para maioria dos casos) — soma ao custo unitário
    const ipiPorUnidade = item.ipi_valor && item.quantidade > 0
      ? item.ipi_valor / item.quantidade
      : 0;

    const custoUnitarioEfetivo = precoComDescontoUnit + ipiPorUnidade;
    const convertedPrice = custoUnitarioEfetivo / conversionFactor;

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

  // Atualizar campo fiscal de um item
  const handleFiscalChange = (itemIndex: number, field: keyof InvoiceItem, value: any) => {
    if (!editedData) return;
    const newItems = [...editedData.itens];
    const item = { ...newItems[itemIndex], [field]: value };

    // Quando IPI muda, recalcular custo convertido se material já vinculado
    if ((field === 'ipi_valor' || field === 'quantidade') && item.material_id && item.conversion_factor) {
      const precoBaseUnit = item.preco_com_desconto
        ? item.preco_com_desconto / item.quantidade
        : item.preco_unitario;
      const ipiPorUnidade = (item.ipi_valor || 0) / (item.quantidade || 1);
      const custoEfetivo = precoBaseUnit + ipiPorUnidade;
      item.converted_unit_price = custoEfetivo / item.conversion_factor;
      item.converted_quantity = item.quantidade * item.conversion_factor;
    }

    newItems[itemIndex] = item;
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

  const handleItemValueChange = (itemIndex: number, field: keyof InvoiceItem, value: any) => {
    if (!editedData) return;

    const item = editedData.itens[itemIndex];
    const newItem = { ...item, [field]: value };

    // Recalcular valores dependentes
    if (field === 'quantidade' || field === 'preco_unitario') {
      newItem.preco_total = newItem.quantidade * newItem.preco_unitario;
      
      // Recalcular desconto percentual se há desconto absoluto
      if (newItem.desconto && newItem.desconto > 0 && newItem.preco_total > 0) {
        newItem.desconto_percentual = (newItem.desconto / newItem.preco_total) * 100;
      }
    }

    if (field === 'desconto') {
      // Atualizar desconto percentual baseado no desconto absoluto
      if (newItem.preco_total > 0 && value > 0) {
        newItem.desconto_percentual = (value / newItem.preco_total) * 100;
      } else {
        newItem.desconto_percentual = 0;
      }
    }

    if (field === 'desconto_percentual') {
      // Atualizar desconto absoluto baseado no percentual
      if (value > 0) {
        newItem.desconto = (value / 100) * newItem.preco_total;
      } else {
        newItem.desconto = 0;
      }
    }

    // Calcular preço com desconto
    if (newItem.desconto && newItem.desconto > 0) {
      newItem.preco_com_desconto = newItem.preco_total - newItem.desconto;
    } else {
      newItem.preco_com_desconto = undefined;
    }

    // Recalcular conversão se material já está vinculado (IPI incluído no custo)
    if (newItem.material_id && newItem.conversion_factor) {
      const precoBaseUnit = newItem.preco_com_desconto
        ? newItem.preco_com_desconto / newItem.quantidade
        : newItem.preco_unitario;
      const ipiPorUnidade = (newItem.ipi_valor || 0) / (newItem.quantidade || 1);
      const custoEfetivo = precoBaseUnit + ipiPorUnidade;
      newItem.converted_quantity = newItem.quantidade * newItem.conversion_factor;
      newItem.converted_unit_price = custoEfetivo / newItem.conversion_factor;
    }

    const newItems = [...editedData.itens];
    newItems[itemIndex] = newItem;
    setEditedData({ ...editedData, itens: newItems });
  };

  const handleAddNewItem = () => {
    if (!editedData) return;
    
    const newItem: InvoiceItem = {
      nome: '',
      quantidade: 1,
      unidade: 'UN',
      preco_unitario: 0,
      preco_total: 0,
      status: 'pending'
    };
    
    setEditedData({
      ...editedData,
      itens: [...editedData.itens, newItem]
    });
  };

  const handleRemoveItem = (itemIndex: number) => {
    if (!editedData) return;
    
    const newItems = editedData.itens.filter((_, idx) => idx !== itemIndex);
    setEditedData({ ...editedData, itens: newItems });
  };

  const handleItemNameChange = (itemIndex: number, newName: string) => {
    if (!editedData) return;
    
    const newItems = [...editedData.itens];
    newItems[itemIndex] = { ...newItems[itemIndex], nome: newName };
    setEditedData({ ...editedData, itens: newItems });
  };

  const handleConversionFactorAdjust = (itemIndex: number, newFactor: number) => {
    if (!editedData) return;

    const item = editedData.itens[itemIndex];
    
    // Calcular preço original e novo preço para detectar desvios grandes
    const originalConvertedPrice = item.converted_unit_price || 0;
    const newConvertedQty = item.quantidade * newFactor;
    
    // Usar preço total com desconto se disponível
    const precoTotalFinal = item.preco_com_desconto || item.preco_total;
    const newConvertedPrice = precoTotalFinal / newConvertedQty;
    
    // Detectar desvio superior a 50% no preço
    if (originalConvertedPrice > 0) {
      const priceVariation = Math.abs((newConvertedPrice - originalConvertedPrice) / originalConvertedPrice) * 100;
      
      if (priceVariation > 50) {
        toast({
          title: "⚠️ Atenção: Grande variação no preço",
          description: `O fator de conversão alterou o preço em ${priceVariation.toFixed(0)}%. Verifique se o valor está correto.`,
          variant: "destructive",
        });
      }
    }
    
    // Recalcular valores de estoque com o novo fator
    const newItems = [...editedData.itens];
    newItems[itemIndex] = {
      ...item,
      conversion_factor: newFactor,
      converted_quantity: newConvertedQty,
      converted_unit_price: newConvertedPrice
    };

    setEditedData({ ...editedData, itens: newItems });
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
        message: 'Responsável não selecionado (recomendado)',
        severity: 'warning'  // FIX: não bloqueia o salvamento
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

    if (!editedData) {
      toast({
        title: 'Dados incompletos',
        description: 'Não há dados da nota fiscal para lançar.',
        variant: 'destructive'
      });
      return;
    }

    if (!supplierId) {
      toast({
        title: 'Fornecedor não selecionado',
        description: 'Selecione um fornecedor antes de lançar a nota.',
        variant: 'destructive'
      });
      return;
    }

    setLaunching(true);

    try {
      // Verificar se já foi lançada (escopo correto — fora dos blocos if)
      let jaLancada = false;
      let originalInvoiceDate: string | null = null;
      let existingInvoiceId = invoiceId;
      if (existingInvoiceId || invoiceId) {
        const checkId = existingInvoiceId || invoiceId;
        const { data: curState } = await supabase
          .from('purchase_invoices')
          .select('stock_posted, invoice_date')
          .eq('id', checkId!)
          .single();
        jaLancada = curState?.stock_posted === true;
        originalInvoiceDate = curState?.invoice_date || null;
      }

      // Buscar nome do fornecedor
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('company_name')
        .eq('id', supplierId)
        .single();

      const fornecedorNome = supplier?.company_name || editedData.fornecedor;

      // Calcular valores com desconto
      // grossSubtotal = soma bruta; perItemDiscountsTotal = descontos individuais dos itens
      // subtotal = base para aplicar o desconto global da nota
      const grossSubtotal = editedData.itens.reduce((sum, item) => sum + item.preco_total, 0);
      const perItemDiscountsTotal = editedData.itens.reduce((sum, item) => sum + (item.desconto || 0), 0);
      const subtotal = grossSubtotal - perItemDiscountsTotal;
      const discountValue = discountType === 'percent'
        ? (discountTotal / 100) * subtotal
        : discountTotal;
      const totalWithDiscount = Math.max(0, subtotal - discountValue);
      // IPI é cobrado separadamente pelo fornecedor e compõe o total da nota
      const ipiGrandTotal = editedData.itens.reduce((s, i) => s + (i.ipi_valor || 0), 0);
      const totalWithFreight = totalWithDiscount + freightAmount + ipiGrandTotal;

      // Totais fiscais calculados dos itens
      const fiscalTotals = {
        icms_total: editedData.itens.reduce((s, i) => s + (i.icms_valor || 0), 0) || null,
        icms_st_total: editedData.itens.reduce((s, i) => s + (i.icms_st_valor || 0), 0) || null,
        ipi_total: ipiGrandTotal || null,
        tributos_aprox_valor: editedData.tributos_aprox_valor || null,
        tributos_aprox_percent: editedData.tributos_aprox_percent || null,
        natureza_operacao: editedData.natureza_operacao || null,
      };

      // Verificar se é uma nota existente (rascunho) ou nova
      let invoiceRecord: { id: string } | null = null;
      
      // Se não temos invoiceId mas temos número da nota, verificar se já existe
      if (!existingInvoiceId && editedData.numero_nota) {
        const { data: existingInvoice } = await supabase
          .from('purchase_invoices')
          .select('id, workflow_status')
          .eq('invoice_number', editedData.numero_nota)
          .maybeSingle();
        
        if (existingInvoice) {
          existingInvoiceId = existingInvoice.id;
          console.log('Nota existente encontrada:', existingInvoiceId, 'status:', existingInvoice.workflow_status);
        }
      }
      
      if (existingInvoiceId) {
        // ATUALIZAR nota existente — NÃO resetar stock_posted se já foi lançada
        const { data: updatedInvoice, error: updateError } = await supabase
          .from('purchase_invoices')
          .update({
            invoice_number: editedData.numero_nota,
            supplier_id: supplierId,
            purchase_order_id: purchaseOrderId,
            invoice_date: new Date(editedData.data).toISOString().split('T')[0],
            total_amount: totalWithFreight,
            discount_total: discountValue,
            discount_type: discountType,
            freight_amount: freightAmount,
            freight_cost_center_id: freightAmount > 0 ? freightCostCenterId : null,
            // Não sobrescrever se já lançada
            workflow_status: jaLancada ? 'lancada' : 'pendente',
            stock_posted: jaLancada ? true : false,
            items_locked: jaLancada ? true : false,
            notes: `${observacoes}\n\nForma de Pagamento: ${formaPagamento}\nResponsável: ${responsavelId}\nStatus Pagamento: ${statusPagamento}\nData Pagamento: ${statusPagamento === 'pago' ? dataPagamento : dataVencimento}${freightAmount > 0 ? `\nFrete: R$ ${freightAmount.toFixed(2)}` : ''}`,
            ...fiscalTotals,
          })
          .eq('id', existingInvoiceId)
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar nota fiscal:', updateError);
          toast({
            title: '❌ Erro ao atualizar nota fiscal',
            description: updateError.message || 'Erro desconhecido ao atualizar nota fiscal',
            variant: 'destructive'
          });
          setLaunching(false);
          return;
        }
        
        invoiceRecord = updatedInvoice;

        // Sincronizar datas nas APs e payment_transactions se a data da NF mudou
        const newInvoiceDate = new Date(editedData.data).toISOString().split('T')[0];
        if (jaLancada && originalInvoiceDate && newInvoiceDate !== originalInvoiceDate) {
          // Atualiza issue_date das contas a pagar vinculadas
          await supabase
            .from('accounts_payable')
            .update({ issue_date: newInvoiceDate })
            .eq('source_id', existingInvoiceId);

          // Atualiza payment_date nos pagamentos cuja data ainda era igual à data original da NF
          // O trigger trg_cash_on_payment (UPDATE) propaga a mudança para cash_transactions automaticamente
          const { data: relatedAPs } = await supabase
            .from('accounts_payable')
            .select('id')
            .eq('source_id', existingInvoiceId);

          if (relatedAPs && relatedAPs.length > 0) {
            await supabase
              .from('payment_transactions')
              .update({ payment_date: newInvoiceDate })
              .in('account_payable_id', relatedAPs.map(ap => ap.id))
              .eq('payment_date', originalInvoiceDate);
          }
        }

        // Remover itens antigos antes de inserir novos
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', existingInvoiceId);
          
      } else {
        // CRIAR nova nota fiscal
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('purchase_invoices')
          .insert({
            invoice_number: editedData.numero_nota,
            supplier_id: supplierId,
            purchase_order_id: purchaseOrderId,
            invoice_date: new Date(editedData.data).toISOString().split('T')[0],
            total_amount: totalWithFreight,
            discount_total: discountValue,
            discount_type: discountType,
            freight_amount: freightAmount,
            freight_cost_center_id: freightAmount > 0 ? freightCostCenterId : null,
            workflow_status: 'pendente',
            stock_posted: false,
            items_locked: false,
            notes: `${observacoes}\n\nForma de Pagamento: ${formaPagamento}\nResponsável: ${responsavelId}\nStatus Pagamento: ${statusPagamento}\nData Pagamento: ${statusPagamento === 'pago' ? dataPagamento : dataVencimento}${freightAmount > 0 ? `\nFrete: R$ ${freightAmount.toFixed(2)}` : ''}`,
            ...fiscalTotals,
          })
          .select()
          .single();

        if (invoiceError) {
          console.error('Erro ao criar nota fiscal:', invoiceError);
          
          // Detectar erro de nota duplicada
          const isDuplicateError = invoiceError.code === '23505' || 
            invoiceError.message?.includes('unique_invoice_number') ||
            invoiceError.message?.includes('duplicate key');
          
          if (isDuplicateError) {
            toast({
              title: '⚠️ Nota fiscal já existe',
              description: `Uma nota com o número "${editedData.numero_nota}" já foi cadastrada no sistema. Verifique se não é uma duplicação.`,
              variant: 'destructive',
              duration: 8000
            });
          } else {
            toast({
              title: '❌ Erro ao criar nota fiscal',
              description: invoiceError.message || 'Erro desconhecido ao criar nota fiscal',
              variant: 'destructive'
            });
          }
          setLaunching(false);
          return;
        }
        
        invoiceRecord = newInvoice;
      }

      // Criar itens da nota fiscal com desconto rateado e fator de conversão
      const invoiceItemsData = editedData.itens.map(item => {
        // Desconto individual do item (vem da NF por item)
        const itemPerItemDiscount = item.desconto || 0;
        const itemAfterPerItem = item.preco_total - itemPerItemDiscount;
        // Desconto global rateado proporcionalmente sobre o valor já com desconto por item
        const itemGlobalDiscount = discountValue > 0 && subtotal > 0
          ? (itemAfterPerItem / subtotal) * discountValue
          : 0;
        const itemTotalDiscount = itemPerItemDiscount + itemGlobalDiscount;

        return {
          invoice_id: invoiceRecord.id,
          material_id: item.material_id,
          quantity: item.quantidade,
          unit_price: item.preco_unitario,
          total_price: item.preco_total,
          discount_amount: itemTotalDiscount,
          discount_percent: item.preco_total > 0 ? (itemTotalDiscount / item.preco_total) * 100 : 0,
          final_price: item.preco_total - itemTotalDiscount,
          conversion_factor: item.conversion_factor || 1,
          converted_quantity: item.converted_quantity || item.quantidade,
          converted_unit_price: item.converted_unit_price || item.preco_unitario,
          unit: item.unidade || 'un',
          description: item.nome,
          // Campos fiscais
          ncm: item.ncm || null,
          cst: item.cst || null,
          cfop: item.cfop || null,
          icms_base: item.icms_base || 0,
          icms_aliquota: item.icms_aliquota || 0,
          icms_valor: item.icms_valor || 0,
          icms_st_base: item.icms_st_base || 0,
          icms_st_valor: item.icms_st_valor || 0,
          ipi_valor: item.ipi_valor || 0,
          ipi_aliquota: item.ipi_aliquota || 0,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) {
        console.error('Erro ao criar itens da nota:', itemsError);
        toast({
          title: '❌ Erro ao criar itens',
          description: itemsError.message || 'Erro ao criar itens da nota fiscal',
          variant: 'destructive'
        });
        throw itemsError;
      }

      // Salvar matches para aprendizado — usando material_name_mappings
      for (const item of editedData.itens) {
        if (item.material_id && item.nome) {
          await supabase
            .from('material_name_mappings')
            .upsert({
              invoice_description: item.nome,
              material_id: item.material_id,
              supplier_name: editedData.fornecedor || null,
            }, {
              onConflict: 'invoice_description,material_id'
            })
            .then(() => {}); // falha silenciosa — não crítico
        }
      }

      // Salvar histórico de fornecedor
      if (supplierId && editedData.fornecedor) {
        const supplierTextNormalized = editedData.fornecedor.toLowerCase().trim();
        await supabase
          .from('invoice_supplier_matches')
          .upsert({
            invoice_supplier_text: editedData.fornecedor,
            invoice_supplier_text_normalized: supplierTextNormalized,
            supplier_id: supplierId
          }, {
            onConflict: 'invoice_supplier_text_normalized,supplier_id'
          });
      }

      toast({
        title: jaLancada ? '✅ Nota fiscal atualizada!' : '✅ Nota fiscal salva!',
        description: jaLancada
          ? 'Dados da nota atualizados. Já foi lançada no estoque anteriormente.'
          : 'Dados salvos. Clique em "Lançar no Estoque" na lista para concluir o lançamento.'
      });
      
      onOpenChange(false);
      onLaunch();

    } catch (error: any) {
      console.error('Erro ao lançar nota fiscal:', error);
      toast({
        title: '❌ Erro ao lançar nota fiscal',
        description: error?.message || 'Ocorreu um erro ao processar a nota fiscal. Verifique os dados e tente novamente.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setLaunching(false);
    }
  };

  // Função para salvar como rascunho (sem validação completa)
  const handleSaveDraft = async () => {
    if (!editedData) return;

    setSaving(true);

    try {
      const grossSubtotalDraft = editedData.itens.reduce((sum, item) => sum + item.preco_total, 0);
      const perItemDiscountsTotalDraft = editedData.itens.reduce((sum, item) => sum + (item.desconto || 0), 0);
      const subtotal = grossSubtotalDraft - perItemDiscountsTotalDraft;
      const discountValue = discountType === 'percent'
        ? (discountTotal / 100) * subtotal
        : discountTotal;
      const totalWithDiscount = subtotal - discountValue;
      // IPI é cobrado separadamente e compõe o total pago ao fornecedor
      const ipiGrandTotalDraft = editedData.itens.reduce((s, i) => s + (i.ipi_valor || 0), 0);
      const totalWithFreight = totalWithDiscount + freightAmount + ipiGrandTotalDraft;

      // Buscar nome do fornecedor se selecionado
      let fornecedorNome = editedData.fornecedor;
      if (supplierId) {
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('company_name')
          .eq('id', supplierId)
          .single();
        fornecedorNome = supplier?.company_name || editedData.fornecedor;
      }

      // Verificar se a nota já foi lançada — não resetar stock_posted/workflow_status
      let jaFoiLancada = false;
      if (invoiceId) {
        const { data: cur } = await supabase
          .from('purchase_invoices').select('stock_posted').eq('id', invoiceId).single();
        jaFoiLancada = cur?.stock_posted === true;
      }

      // Totais fiscais calculados dos itens
      const fiscalTotalsDraft = {
        icms_total: editedData.itens.reduce((s, i) => s + (i.icms_valor || 0), 0) || null,
        icms_st_total: editedData.itens.reduce((s, i) => s + (i.icms_st_valor || 0), 0) || null,
        ipi_total: editedData.itens.reduce((s, i) => s + (i.ipi_valor || 0), 0) || null,
        tributos_aprox_valor: editedData.tributos_aprox_valor || null,
        tributos_aprox_percent: editedData.tributos_aprox_percent || null,
        natureza_operacao: editedData.natureza_operacao || null,
      };

      // Criar ou atualizar registro da nota fiscal como rascunho
      const invoicePayload = {
        invoice_number: editedData.numero_nota || `RASCUNHO-${Date.now()}`,
        supplier_id: supplierId,
        purchase_order_id: purchaseOrderId,
        invoice_date: editedData.data ? new Date(editedData.data).toISOString().split('T')[0] : todayLocalISO(),
        total_amount: totalWithFreight,
        discount_total: discountValue,
        discount_type: discountType,
        freight_amount: freightAmount,
        freight_cost_center_id: freightAmount > 0 ? freightCostCenterId : null,
        // FIX: não resetar se já foi lançada
        workflow_status: jaFoiLancada ? 'lancada' : 'rascunho',
        stock_posted: jaFoiLancada ? true : false,
        items_locked: jaFoiLancada ? true : false,
        notes: `${observacoes || ''}\n\nForma de Pagamento: ${formaPagamento || 'Não definida'}\nResponsável: ${responsavelId || 'Não definido'}${freightAmount > 0 ? `\nFrete: R$ ${freightAmount.toFixed(2)}` : ''}`,
        ...fiscalTotalsDraft,
      };

      let invoiceRecord;
      
      if (invoiceId) {
        // Atualizar nota existente
        const { data, error } = await supabase
          .from('purchase_invoices')
          .update(invoicePayload)
          .eq('id', invoiceId)
          .select()
          .single();
        
        if (error) throw error;
        invoiceRecord = data;

        // Deletar itens existentes para recriar
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId);
      } else {
        // Criar nova nota
        const { data, error } = await supabase
          .from('purchase_invoices')
          .insert(invoicePayload)
          .select()
          .single();
        
        if (error) throw error;
        invoiceRecord = data;
      }

      // Criar itens da nota fiscal
      if (editedData.itens.length > 0) {
        const invoiceItemsData = editedData.itens.map(item => {
          const itemDiscount = discountValue > 0 && subtotal > 0
            ? (item.preco_total / subtotal) * discountValue
            : (item.desconto || 0);
          
          return {
            invoice_id: invoiceRecord.id,
            material_id: item.material_id || null,
            quantity: item.quantidade,
            unit_price: item.preco_unitario,
            total_price: item.preco_total,
            discount_amount: itemDiscount,
            discount_percent: item.preco_total > 0 ? (itemDiscount / item.preco_total) * 100 : 0,
            final_price: item.preco_total - itemDiscount,
            conversion_factor: item.conversion_factor || 1,
            converted_quantity: item.converted_quantity || item.quantidade,
            converted_unit_price: item.converted_unit_price || item.preco_unitario,
            unit: item.unidade || 'un',
            description: item.nome,
            // Campos fiscais
            ncm: item.ncm || null,
            cst: item.cst || null,
            cfop: item.cfop || null,
            icms_base: item.icms_base || 0,
            icms_aliquota: item.icms_aliquota || 0,
            icms_valor: item.icms_valor || 0,
            icms_st_base: item.icms_st_base || 0,
            icms_st_valor: item.icms_st_valor || 0,
            ipi_valor: item.ipi_valor || 0,
            ipi_aliquota: item.ipi_aliquota || 0,
          };
        });

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItemsData);

        if (itemsError) {
          console.error('Erro ao criar itens:', itemsError);
          throw itemsError;
        }
      }

      toast({
        title: '✅ Rascunho salvo',
        description: 'Nota fiscal salva como rascunho. Você pode continuar editando depois.'
      });

      onOpenChange(false);
      onSaveDraft?.();

    } catch (error: any) {
      console.error('Erro ao salvar rascunho:', error);
      toast({
        title: '❌ Erro ao salvar',
        description: error?.message || 'Ocorreu um erro ao salvar o rascunho.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
            {purchaseOrderId && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  Itens importados do Pedido de Compra <strong>{purchaseOrderNumber || ''}</strong> — confira quantidades e preços antes de lançar.
                </AlertDescription>
              </Alert>
            )}

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

            {/* Status e Data de Pagamento */}
            <div className="space-y-2">
              <Label>Status do Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'pago',     label: '✅ Já foi pago',       desc: 'Pagamento já realizado' },
                  { value: 'a_vencer', label: '📅 A pagar / Boleto', desc: 'Aguardando pagamento' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusPagamento(opt.value as 'pago' | 'a_vencer')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      statusPagamento === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {statusPagamento === 'pago' ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data do Pagamento</Label>
                    <Input
                      type="date"
                      value={dataPagamento}
                      onChange={e => setDataPagamento(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Informe a data real, mesmo que retroativa</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data de Vencimento</Label>
                    <Input
                      type="date"
                      value={dataVencimento}
                      onChange={e => setDataVencimento(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Vencimento do boleto ou prazo</p>
                  </div>
                )}
              </div>
            </div>

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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Itens da Nota ({editedData.itens.length})</h3>
                {canEditItems && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddNewItem}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Item
                  </Button>
                )}
              </div>
              {editedData.itens.map((item, idx) => (
                <div key={idx} className="relative">
                  <InvoiceItemMatcher
                    item={item}
                    index={idx}
                    onMaterialSelect={handleMaterialSelect}
                    onCreateNew={handleCreateNew}
                    onConversionFactorAdjust={handleConversionFactorAdjust}
                    onItemValueChange={handleItemValueChange}
                    onItemNameChange={handleItemNameChange}
                    onFiscalChange={handleFiscalChange}
                    canEditName={canEditItems}
                  />
                  {canEditItems && editedData.itens.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="absolute top-2 right-2 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Desconto Global */}
            <div className="p-4 bg-muted/30 rounded-lg border">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Desconto na Nota
              </h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select 
                    value={discountType} 
                    onValueChange={(v: 'value' | 'percent') => setDiscountType(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3" />
                          Valor (R$)
                        </div>
                      </SelectItem>
                      <SelectItem value="percent">
                        <div className="flex items-center gap-2">
                          <Percent className="h-3 w-3" />
                          Percentual (%)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    {discountType === 'percent' ? 'Percentual' : 'Valor'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={discountType === 'percent' ? '0.1' : '0.01'}
                    max={discountType === 'percent' ? '100' : undefined}
                    value={discountTotal}
                    onChange={(e) => setDiscountTotal(parseFloat(e.target.value) || 0)}
                    placeholder={discountType === 'percent' ? '5%' : 'R$ 50,00'}
                    className="h-9"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O desconto será rateado proporcionalmente entre todos os itens da nota.
              </p>
            </div>

            {/* Frete como Despesa Separada */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Truck className="h-4 w-4" />
                Frete / Tele-entrega (Despesa Separada)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor do Frete</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freightAmount}
                    onChange={(e) => setFreightAmount(parseFloat(e.target.value) || 0)}
                    placeholder="R$ 0,00"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Centro de Custo</Label>
                  <Select 
                    value={freightCostCenterId || ''} 
                    onValueChange={setFreightCostCenterId}
                    disabled={freightAmount === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                O frete será lançado como despesa no centro de custo selecionado, não afetando o custo dos produtos.
              </p>
            </div>

            {/* Total */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              {(() => {
                const grossSubtotalDisplay = editedData.itens.reduce((sum, item) => sum + item.preco_total, 0);
                const perItemDiscountsDisplay = editedData.itens.reduce((sum, item) => sum + (item.desconto || 0), 0);
                const subtotal = grossSubtotalDisplay - perItemDiscountsDisplay;
                const discountValue = discountType === 'percent'
                  ? (discountTotal / 100) * subtotal
                  : discountTotal;
                const totalProducts = Math.max(0, subtotal - discountValue);
                const ipiDisplay = editedData.itens.reduce((s, i) => s + (i.ipi_valor || 0), 0);
                const totalWithFreight = totalProducts + freightAmount + ipiDisplay;

                return (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Subtotal Produtos:</span>
                      <span className="font-medium">R$ {grossSubtotalDisplay.toFixed(2)}</span>
                    </div>
                    {perItemDiscountsDisplay > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Descontos por item:</span>
                        <span>- R$ {perItemDiscountsDisplay.toFixed(2)}</span>
                      </div>
                    )}
                    {discountValue > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Desconto na Nota ({discountType === 'percent' ? `${discountTotal}%` : 'valor'}):</span>
                        <span>- R$ {discountValue.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Produtos:</span>
                      <span className="font-medium">R$ {totalProducts.toFixed(2)}</span>
                    </div>
                    {ipiDisplay > 0 && (
                      <div className="flex justify-between items-center text-sm text-amber-700">
                        <span>IPI (cobrado à parte):</span>
                        <span>+ R$ {ipiDisplay.toFixed(2)}</span>
                      </div>
                    )}
                    {freightAmount > 0 && (
                      <div className="flex justify-between items-center text-sm text-blue-600">
                        <span>Frete (despesa):</span>
                        <span>+ R$ {freightAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-semibold">Total da Nota:</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {totalWithFreight.toFixed(2)}
                      </span>
                    </div>
                    {(() => {
                      const totalIcms = editedData.itens.reduce((s, i) => s + (i.icms_valor || 0), 0);
                      const totalIpi = ipiDisplay;
                      const totalIcmsSt = editedData.itens.reduce((s, i) => s + (i.icms_st_valor || 0), 0);
                      if (totalIcms === 0 && totalIpi === 0 && totalIcmsSt === 0) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impostos (referência)</p>
                          {totalIcms > 0 && (
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>ICMS Total:</span>
                              <span>R$ {totalIcms.toFixed(2)}</span>
                            </div>
                          )}
                          {totalIcmsSt > 0 && (
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>ICMS-ST Total:</span>
                              <span>R$ {totalIcmsSt.toFixed(2)}</span>
                            </div>
                          )}
                          {totalIpi > 0 && (
                            <div className="flex justify-between items-center text-xs text-amber-700 font-medium">
                              <span>IPI (⚡ incluso no total e no custo unitário):</span>
                              <span>R$ {totalIpi.toFixed(2)}</span>
                            </div>
                          )}
                          {editedData.tributos_aprox_percent && editedData.tributos_aprox_percent > 0 && (
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>Tributos Aprox. ({editedData.tributos_aprox_percent}%):</span>
                              <span>R$ {(editedData.tributos_aprox_valor || 0).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            {/* Aviso de itens travados */}
            {itemsLocked && !isAdmin && (
              <Alert className="border-amber-200 bg-amber-50">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Itens Bloqueados</AlertTitle>
                <AlertDescription className="text-amber-700">
                  Esta nota já foi lançada e os itens estão bloqueados para edição. 
                  Apenas administradores podem modificar os itens.
                </AlertDescription>
              </Alert>
            )}

            {/* Validação */}
            {validationErrors.length > 0 && (
              <ValidationAlert errors={validationErrors} />
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={launching || saving}>
              Cancelar
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              <Button 
                variant="secondary" 
                onClick={handleSaveDraft} 
                disabled={launching || saving}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Salvar Rascunho</>
                )}
              </Button>
              <Button onClick={handleLaunch} disabled={launching || saving} title="Salva os dados da nota. O lançamento no estoque é feito pela lista.">
                {launching ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lançando...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />Salvar Nota</>
                )}
              </Button>
            </div>
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

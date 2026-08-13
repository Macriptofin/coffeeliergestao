import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, ShoppingCart, X, Package, Shield, Trash2, CreditCard, FileEdit, Lock, Clock, Upload, CheckCircle2, Circle, History, Filter, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InvoiceOCRUploader } from "@/components/purchase/InvoiceOCRUploader";
import type { PurchaseInvoice } from "@/pages/Stock";
import { useUserRole } from "@/hooks/useUserRole";
import { InvoiceEditDialog } from "../purchase/InvoiceEditDialog";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { todayLocalISO, addDaysLocalISO, formatLocalDate } from "@/lib/date-utils";

interface Supplier {
  id: string;
  companyName: string;
}

interface Ingredient {
  id: string;
  name: string;
  purchaseUnit: string;
  usageUnit: string;
  conversionFactor: number;
}

interface InvoiceItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  purchaseUnit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PurchaseInvoicesProps {
  invoices: PurchaseInvoice[];
  onRefresh: () => void;
}

interface OpenPurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
}

const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_INGREDIENTS: Ingredient[] = [];
const EMPTY_OPEN_POS: OpenPurchaseOrder[] = [];
const EMPTY_PAYABLES: any[] = [];

// Mesma queryKey/shape de SupplierProducts.tsx — cache compartilhado.
async function fetchActiveSuppliersList(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('status', 'Ativo')
    .order('company_name');

  if (error) throw error;

  return data.map(item => ({
    id: item.id,
    companyName: item.company_name
  }));
}

async function fetchMaterialsForInvoice(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, purchase_unit, usage_unit, conversion_factor')
    .order('name');

  if (error) throw error;

  return data.map(item => ({
    id: item.id,
    name: item.name,
    purchaseUnit: item.purchase_unit,
    usageUnit: item.usage_unit,
    conversionFactor: parseFloat(item.conversion_factor?.toString() || '1')
  }));
}

// Pedidos de compra aprovados/enviados que ainda não têm nenhuma NF vinculada
async function fetchOpenPurchaseOrdersForInvoice(): Promise<OpenPurchaseOrder[]> {
  const { data: linked } = await supabase
    .from('purchase_invoices')
    .select('purchase_order_id')
    .not('purchase_order_id', 'is', null);
  const linkedIds = (linked || []).map((l: any) => l.purchase_order_id).filter(Boolean);

  let query = supabase
    .from('purchase_orders')
    .select('id, order_number, supplier_id, suppliers(company_name)')
    .in('status', ['Aprovado', 'Enviado'])
    .order('order_date', { ascending: false });

  if (linkedIds.length > 0) {
    query = query.not('id', 'in', `(${linkedIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    supplier_id: o.supplier_id,
    supplier_name: o.suppliers?.company_name || 'N/A',
  }));
}

async function fetchExistingPayablesForInvoices(invoiceNumbers: string[]) {
  const { data, error } = await supabase
    .from('accounts_payable')
    .select('invoice_number, supplier_id')
    .in('invoice_number', invoiceNumbers);
  if (error) throw error;
  return data || [];
}

export function PurchaseInvoices({ invoices, onRefresh }: PurchaseInvoicesProps) {
  const { isAdmin, can, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const { methodNames: paymentMethodNames } = usePaymentMethods();
  const { data: suppliers = EMPTY_SUPPLIERS } = useQuery({
    queryKey: ['active-suppliers-list'],
    queryFn: fetchActiveSuppliersList,
  });
  const { data: ingredients = EMPTY_INGREDIENTS } = useQuery({
    queryKey: ['materials-for-invoice'],
    queryFn: fetchMaterialsForInvoice,
  });
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [manualInvoiceData, setManualInvoiceData] = useState<any>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingItemsLocked, setEditingItemsLocked] = useState(false);
  const [linkedPurchaseOrder, setLinkedPurchaseOrder] = useState<{ id: string; order_number: string } | null>(null);
  const [poPickerOpen, setPoPickerOpen] = useState(false);
  const { data: openPurchaseOrders = EMPTY_OPEN_POS, isFetching: loadingPOs, refetch: refetchOpenPOs } = useQuery({
    queryKey: ['open-purchase-orders-for-invoice'],
    queryFn: fetchOpenPurchaseOrdersForInvoice,
    enabled: poPickerOpen,
  });
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'Dinheiro',
    responsiblePerson: '',
    paymentDate: todayLocalISO(),
    createPayable: true
  });
  const [retroactivePaymentData, setRetroactivePaymentData] = useState({
    paymentMethod: 'Dinheiro',
    responsiblePerson: '',
    paymentDate: todayLocalISO()
  });
  const [showRetroactiveDialog, setShowRetroactiveDialog] = useState(false);
  const [selectedInvoiceForRetroactive, setSelectedInvoiceForRetroactive] = useState<any>(null);
  // Resumo de confirmação antes de "Lançar no Estoque" — essa ação grava
  // estoque + financeiro de uma vez, sem volta fácil, por isso pede revisão.
  const [launchConfirm, setLaunchConfirm] = useState<{
    id: string; invoiceNumber: string; supplierName: string; totalAmount: number;
    itemCount: number; isPaid: boolean; paymentDate: string | null; dueDate: string | null;
    paymentMethod: string | null;
  } | null>(null);
  const [launchConfirmLoading, setLaunchConfirmLoading] = useState(false);
  // Dialog de condição de pagamento antes de lançar no estoque
  const [showPaymentConditionDialog, setShowPaymentConditionDialog] = useState(false);
  const [invoiceToLaunch, setInvoiceToLaunch] = useState<string | null>(null);
  const [paymentCondition, setPaymentCondition] = useState<'pago' | 'a_pagar'>('pago');
  const [launchPaymentData, setLaunchPaymentData] = useState({
    paymentStatus: 'pago' as 'pago' | 'a_pagar',
    paymentDate:   todayLocalISO(),
    dueDate:       todayLocalISO(),
    paymentMethod: 'PIX',
    bankAccountId: '',
    notes:         '',
  });
  const invoiceNumbers = useMemo(() => invoices.map(inv => inv.invoiceNumber), [invoices]);
  const { data: existingPayables = EMPTY_PAYABLES } = useQuery({
    queryKey: ['existing-payables', invoiceNumbers],
    queryFn: () => fetchExistingPayablesForInvoices(invoiceNumbers),
    enabled: invoiceNumbers.length > 0,
  });
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  // View mode: "pending" mostra NFs que precisam de ação; "history" mostra concluídas
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
  const [isOCRSheetOpen, setIsOCRSheetOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({ supplierId: '', period: '' });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEditLockedDialog, setShowEditLockedDialog] = useState(false);
  const [lockedInvoiceIdToEdit, setLockedInvoiceIdToEdit] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    notes: '',
    formaPagamento: '',
    numeroParcelas: 1,
    prazoPagamentoDias: 30,
  });

  const openNewInvoiceDialog = () => {
    // Abrir diálogo vazio para nova nota fiscal
    const emptyInvoiceData = {
      fornecedor: '',
      data: todayLocalISO(),
      numero_nota: '',
      itens: []
    };
    
    setManualInvoiceData(emptyInvoiceData);
    setEditingInvoiceId(null);
    setEditingSupplierId(null);
    setEditingItemsLocked(false);
    setLinkedPurchaseOrder(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleInvoiceLaunch = () => {
    setIsInvoiceDialogOpen(false);
    setManualInvoiceData(null);
    setEditingInvoiceId(null);
    setEditingSupplierId(null);
    setEditingItemsLocked(false);
    setLinkedPurchaseOrder(null);
    onRefresh();
  };

  const openInvoiceFromPurchaseOrder = async (order: OpenPurchaseOrder) => {
    setPoPickerOpen(false);
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from('purchase_order_items')
        .select('material_id, quantity, unit, unit_price, materials(name, code, usage_unit, conversion_factor)')
        .eq('purchase_order_id', order.id)
        .order('position');
      if (error) throw error;

      const itens = (items || []).map((it: any) => {
        const mat = it.materials;
        const conversionFactor = parseFloat(mat?.conversion_factor?.toString() || '1') || 1;
        const quantidade = parseFloat(it.quantity?.toString() || '0');
        const precoUnitario = parseFloat(it.unit_price?.toString() || '0');
        return {
          nome: mat?.name || '',
          quantidade,
          unidade: it.unit || mat?.usage_unit || 'un',
          preco_unitario: precoUnitario,
          preco_total: quantidade * precoUnitario,
          material_id: it.material_id,
          material_nome: mat?.name || null,
          material_codigo: mat?.code || null,
          status: 'matched' as const,
          conversion_factor: conversionFactor,
          usage_unit: mat?.usage_unit,
          converted_quantity: quantidade * conversionFactor,
          converted_unit_price: precoUnitario / conversionFactor,
        };
      });

      setManualInvoiceData({
        fornecedor: order.supplier_name,
        data: todayLocalISO(),
        numero_nota: '',
        itens,
      });
      setEditingInvoiceId(null);
      setEditingSupplierId(order.supplier_id);
      setEditingItemsLocked(false);
      setLinkedPurchaseOrder({ id: order.id, order_number: order.order_number });
      setIsInvoiceDialogOpen(true);
    } catch (error) {
      console.error('Erro ao importar itens do pedido de compra:', error);
      toast.error('Erro ao importar itens do pedido de compra');
    } finally {
      setLoading(false);
    }
  };

  const startEditInvoice = async (invoiceId: string) => {
    try {
      setLoading(true);
      
      // Carregar dados da nota fiscal
      const { data: invoice, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          suppliers:supplier_id (
            id,
            company_name
          ),
          purchase_orders:purchase_order_id (
            id,
            order_number
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      // Carregar itens da nota fiscal
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          *,
          materials:material_id (
            id,
            name,
            code,
            usage_unit
          )
        `)
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Converter para formato do InvoiceEditDialog
      const invoiceData = {
        fornecedor: invoice.suppliers?.company_name || '',
        data: invoice.invoice_date || '',
        numero_nota: invoice.invoice_number || '',
        itens: (items || []).map((item: any) => ({
          nome: item.description || item.materials?.name || '',
          quantidade: item.quantity || 0,
          unidade: item.unit || 'un',
          preco_unitario: item.unit_price || 0,
          preco_total: item.total_price ?? ((item.quantity || 0) * (item.unit_price || 0)),
          desconto: item.discount_amount || 0,
          desconto_percentual: item.discount_percent || 0,
          preco_com_desconto: item.final_price ?? null,
          material_id: item.material_id,
          material_nome: item.materials?.name,
          material_codigo: item.materials?.code,
          status: item.material_id ? 'matched' : 'not_found',
          conversion_factor: item.conversion_factor || 1,
          usage_unit: item.materials?.usage_unit || item.unit,
          converted_quantity: item.converted_quantity || item.quantity,
          converted_unit_price: item.converted_unit_price || item.unit_price,
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
        })),
        discount_total: invoice.discount_total || 0,
        discount_type: (invoice.discount_type as 'value' | 'percent') || 'value',
        // Totalizadores fiscais da nota
        icms_total: invoice.icms_total || null,
        icms_st_total: invoice.icms_st_total || null,
        ipi_total: invoice.ipi_total || null,
        tributos_aprox_valor: invoice.tributos_aprox_valor || null,
        tributos_aprox_percent: invoice.tributos_aprox_percent || null,
        natureza_operacao: invoice.natureza_operacao || null,
      };

      setManualInvoiceData(invoiceData);
      setEditingInvoiceId(invoiceId);
      setEditingSupplierId(invoice.supplier_id);
      setEditingItemsLocked(invoice.items_locked || false);
      setLinkedPurchaseOrder(
        invoice.purchase_orders ? { id: invoice.purchase_orders.id, order_number: invoice.purchase_orders.order_number } : null
      );
      setIsInvoiceDialogOpen(true);
    } catch (error) {
      console.error('Erro ao carregar nota fiscal:', error);
      toast.error('Erro ao carregar dados da nota fiscal');
    } finally {
      setLoading(false);
    }
  };

  // Admin digita a senha para desbloquear edição de NF já lançada
  const handleAdminEditAuth = async () => {
    if (!adminPassword || !lockedInvoiceIdToEdit) return;
    setIsAuthenticating(true);
    setAdminAuthError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setAdminAuthError('Sessão inválida. Faça login novamente.'); return; }
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });
      if (error) {
        setAdminAuthError('Senha incorreta. Tente novamente.');
        return;
      }
      // Autenticação OK — abrir edição
      setShowEditLockedDialog(false);
      setAdminPassword('');
      setAdminAuthError('');
      const invoiceId = lockedInvoiceIdToEdit;
      setLockedInvoiceIdToEdit(null);
      startEditInvoice(invoiceId);
    } catch {
      setAdminAuthError('Erro ao verificar senha. Tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const saveEditedInvoice = async () => {
    if (!editingInvoice) return;

    try {
      setLoading(true);

      // Atualizar dados da nota fiscal
      const { error: updateError } = await supabase
        .from('purchase_invoices')
        .update({
          invoice_number: editFormData.invoiceNumber,
          invoice_date: editFormData.invoiceDate,
          notes: `${editFormData.notes}\n\nForma de Pagamento: ${editFormData.formaPagamento}\nParcelas: ${editFormData.numeroParcelas}\nPrazo: ${editFormData.prazoPagamentoDias} dias`
        })
        .eq('id', editingInvoice.id);

      if (updateError) throw updateError;

      // Sincronizar issue_date nas APs vinculadas (due_date preservada, pois pode ter sido negociada)
      await supabase
        .from('accounts_payable')
        .update({ issue_date: editFormData.invoiceDate })
        .eq('source_id', editingInvoice.id);

      // Sincronizar payment_date nos payment_transactions cujo payment_date era igual à data original da NF
      // O trigger trg_cash_on_payment (UPDATE) vai propagar a mudança para cash_transactions automaticamente
      const { data: relatedAPs } = await supabase
        .from('accounts_payable')
        .select('id')
        .eq('source_id', editingInvoice.id);

      if (relatedAPs && relatedAPs.length > 0) {
        const apIds = relatedAPs.map(ap => ap.id);
        await supabase
          .from('payment_transactions')
          .update({ payment_date: editFormData.invoiceDate })
          .in('account_payable_id', apIds)
          .eq('payment_date', editingInvoice.invoice_date); // só atualiza se ainda tem a data original
      }

      toast.success('Nota fiscal atualizada — datas sincronizadas com contas a pagar e fluxo de caixa');
      setShowEditDialog(false);
      setEditingInvoice(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao atualizar nota fiscal:', error);
      toast.error('Erro ao atualizar nota fiscal');
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      // Confirmar exclusão
      const confirmed = window.confirm('Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita.');
      if (!confirmed) return;

      setLoading(true);

      // Verificar se a nota foi lançada no estoque
      const { data: invoice, error: checkError } = await supabase
        .from('purchase_invoices')
        .select('stock_posted, invoice_number')
        .eq('id', invoiceId)
        .single();

      if (checkError) throw checkError;

      if (invoice.stock_posted) {
        // Se foi lançada no estoque, reverter as movimentações
        const confirmed2 = window.confirm(
          `Esta nota fiscal já foi lançada no estoque. Ao excluí-la, as movimentações de estoque serão revertidas. Confirma a exclusão?`
        );
        if (!confirmed2) {
          setLoading(false);
          return;
        }

        // Reverter movimentações de estoque
        const { data: movements, error: getMovementsError } = await supabase
          .from('stock_movements')
          .select('material_id, quantity, unit_price')
          .eq('reference_type', 'Compra')
          .eq('reference_id', invoiceId);

        if (getMovementsError) {
          console.error('Erro ao buscar movimentações:', getMovementsError);
          throw getMovementsError;
        }

        // Excluir movimentações de estoque
        const { error: deleteMovementsError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('reference_type', 'Compra')
          .eq('reference_id', invoiceId);

        if (deleteMovementsError) {
          console.error('Erro ao reverter movimentações:', deleteMovementsError);
          throw deleteMovementsError;
        }

        // Recalcular preço médio para cada material afetado (current_quantity já foi
        // atualizado pelo trigger trg_sync_stock_quantity ao deletar os movimentos)
        if (movements) {
          const uniqueMaterialIds = [...new Set(movements.map(m => m.material_id))];
          for (const materialId of uniqueMaterialIds) {
            await supabase.rpc('calculate_weighted_average_price', {
              p_material_id: materialId
            });
          }
        }
      }

      // Excluir itens da nota fiscal
      const { error: deleteItemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (deleteItemsError) {
        console.error('Erro ao excluir itens da nota:', deleteItemsError);
        throw deleteItemsError;
      }

      // Excluir a nota fiscal
      const { error: deleteInvoiceError } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceId);

      if (deleteInvoiceError) {
        console.error('Erro ao excluir nota fiscal:', deleteInvoiceError);
        throw deleteInvoiceError;
      }

      toast.success(`Nota fiscal ${invoice.invoice_number} excluída com sucesso`);
      onRefresh();
    } catch (error) {
      console.error('Erro ao excluir nota fiscal:', error);
      toast.error('Erro ao excluir nota fiscal');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentConditionDialog = (invoiceId: string) => {
    setInvoiceToLaunch(invoiceId);
    setLaunchPaymentData({
      paymentStatus: 'pago',
      paymentDate:   todayLocalISO(),
      dueDate:       addDaysLocalISO(30),
      paymentMethod: 'PIX',
      bankAccountId: '',
      notes:         '',
    });
    setShowPaymentConditionDialog(true);
  };

  const confirmAndLaunch = async () => {
    if (!invoiceToLaunch) return;
    setShowPaymentConditionDialog(false);
    await postToStock(invoiceToLaunch);
  };

  // Abre o resumo de confirmação antes de lançar — "Lançar no Estoque" grava
  // movimentação de estoque + conta a pagar + pagamento numa tacada só, sem
  // nenhuma revisão hoje (achado durante a investigação do agente de NF).
  const openLaunchConfirm = async (invoice: PurchaseInvoice) => {
    setLaunchConfirmLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('notes, invoice_items(count)')
        .eq('id', invoice.id)
        .single();
      if (error) throw error;

      const notesText = data?.notes || '';
      const statusMatch = notesText.match(/Status Pagamento:\s*(pago|a_vencer)/i);
      const dateMatch   = notesText.match(/Data Pagamento:\s*(\d{4}-\d{2}-\d{2})/i);
      const methodMatch = notesText.match(/Forma de Pagamento:\s*([^\n]+)/i);
      const isPaid = statusMatch?.[1]?.toLowerCase() === 'pago';

      setLaunchConfirm({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplier?.companyName || '—',
        totalAmount: invoice.totalAmount,
        itemCount: (data as any)?.invoice_items?.[0]?.count ?? 0,
        isPaid,
        paymentDate: isPaid ? (dateMatch?.[1] || null) : null,
        dueDate: !isPaid ? (dateMatch?.[1] || null) : null,
        paymentMethod: methodMatch?.[1]?.trim() || null,
      });
    } catch (err) {
      console.error('Erro ao carregar resumo da nota:', err);
      toast.error('Não foi possível carregar o resumo da nota para confirmação.');
    } finally {
      setLaunchConfirmLoading(false);
    }
  };

  const postToStock = async (invoiceId: string) => {
    setLoading(true);
    try {
      // Verificar se a nota já foi lançada no estoque
      const { data: invoice, error: checkError } = await supabase
        .from('purchase_invoices')
        .select(`
          stock_posted,
          invoice_number,
          invoice_date,
          total_amount,
          discount_total,
          freight_amount,
          freight_cost_center_id,
          notes,
          purchase_order_id,
          suppliers:supplier_id (
            id,
            company_name
          )
        `)
        .eq('id', invoiceId)
        .single();

      // Extrair status, data e forma de pagamento do campo notes (dados reais
      // digitados no formulário da NF — launchPaymentData é resquício de um
      // dialog nunca aberto na prática, sempre no default 'PIX').
      const notesText = invoice?.notes || '';
      const statusMatch = notesText.match(/Status Pagamento:\s*(pago|a_vencer)/i);
      const dateMatch   = notesText.match(/Data Pagamento:\s*(\d{4}-\d{2}-\d{2})/i);
      const methodMatch = notesText.match(/Forma de Pagamento:\s*([^\n]+)/i);
      const invoicePaymentStatus = statusMatch?.[1] || 'a_vencer';
      const invoicePaymentDate   = dateMatch?.[1] || todayLocalISO();
      const invoicePaymentMethod = methodMatch?.[1]?.trim() || launchPaymentData.paymentMethod;

      if (checkError) throw checkError;

      if (invoice.stock_posted) {
        toast.error('Esta nota fiscal já foi lançada no estoque');
        setLoading(false);
        return;
      }

      // Verificar se o fornecedor ainda existe no sistema
      if (!invoice.suppliers) {
        toast.error('Fornecedor da nota fiscal não encontrado no sistema. Cadastre o fornecedor antes de lançar no estoque.');
        setLoading(false);
        return;
      }

      // Carregar itens da nota fiscal
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select(`
          *,
          materials:material_id (
            id,
            name,
            purchase_unit,
            usage_unit,
            conversion_factor,
            tracks_inventory
          )
        `)
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Verificar se todos os materiais ainda existem no sistema
      const missingMaterials = items.filter(item => !item.materials);
      if (missingMaterials.length > 0) {
        toast.error(`Alguns materiais da nota fiscal não foram encontrados no sistema. Cadastre todos os materiais antes de lançar no estoque.`);
        setLoading(false);
        return;
      }

      // Processar movimentações de estoque para cada item
      for (const item of items) {
        const material = item.materials;
        
        if (!material) {
          toast.error(`Material não encontrado para o item ${item.material_id}`);
          continue;
        }

        // Pular movimentação de estoque para materiais de consumo (combustível, descartáveis, etc.)
        if (material.tracks_inventory === false) {
          continue;
        }

        // IMPORTANTE: Usar fator de conversão salvo no item da nota (ajustado pelo usuário)
        // Se não existir, usar o fator do cadastro do material como fallback
        const conversionFactor = item.conversion_factor 
          ? parseFloat(item.conversion_factor.toString()) 
          : parseFloat(material.conversion_factor?.toString() || '1');
        
        // Usar valores convertidos salvos no item, ou calcular se não existirem
        const usageQuantity = item.converted_quantity 
          ? parseFloat(item.converted_quantity.toString())
          : parseFloat(item.quantity?.toString() || '0') * conversionFactor;
        
        const usageUnitPrice = item.converted_unit_price 
          ? parseFloat(item.converted_unit_price.toString())
          : parseFloat(item.unit_price?.toString() || '0') / conversionFactor;
        
        const purchaseUnit = item.unit || material.purchase_unit || 'un';
        
        // Criar movimentação de estoque
        const { error: stockError } = await supabase
          .from('stock_movements')
          .insert({
            material_id: item.material_id,
            movement_type: 'Entrada',
            quantity: usageQuantity,
            unit_price: usageUnitPrice,
            total_cost: usageQuantity * usageUnitPrice,
            reference_type: 'Compra',
            reference_id: invoiceId,
            notes: `Nota fiscal ${invoice.invoice_number} - Compra: ${item.quantity} ${purchaseUnit} = ${usageQuantity.toFixed(2)} ${material.usage_unit}`
          });

        if (stockError) {
          console.error('Erro ao criar movimentação de estoque:', stockError);
          throw stockError;
        }
        // current_quantity já é atualizado automaticamente pelo trigger trg_sync_stock_quantity
        // trg_update_weighted_average cuida do average_price via V1 RPC
      }

      // Criar contas a pagar com condição de pagamento definida pelo usuário
      if (paymentData.createPayable) {
        const currentDate = todayLocalISO();
        // Usar dados salvos no formulário da NF (status e data de pagamento)
        const isPaid  = invoicePaymentStatus === 'pago';
        const dueDate = invoicePaymentDate;
        const totalAmount = parseFloat(invoice.total_amount?.toString() || '0');
        const freightAmount = parseFloat(invoice.freight_amount?.toString() || '0');
        const productsAmount = totalAmount - freightAmount;
        
        // 1. CONTA A PAGAR - PRODUTOS (vinculada ao fornecedor)
        if (productsAmount > 0) {
          // Buscar conta contábil 5.1.1 - Compras de Mercadorias
          const { data: purchaseAccount } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('code', '5.1.1')
            .single();

          const { data: productsPayable, error: productsPayableError } = await supabase
            .from('accounts_payable')
            .insert({
              supplier_id: invoice.suppliers.id,
              invoice_number: invoice.invoice_number,
              document_number: invoice.invoice_number,
              description: `NF ${invoice.invoice_number} - ${invoice.suppliers.company_name} (Produtos)`,
              issue_date: invoice.invoice_date || currentDate,
              due_date: dueDate,
              original_amount: productsAmount,
              remaining_amount: isPaid ? 0 : productsAmount,
              paid_amount: isPaid ? productsAmount : 0,
              payment_date: isPaid ? invoicePaymentDate : null,
              discount_amount: parseFloat(invoice.discount_total?.toString() || '0'),
              interest_amount: 0,
              status: isPaid ? 'Pago' : 'Pendente',
              source_type: 'purchase_invoice',
              source_id: invoiceId,
              account_id: purchaseAccount?.id || null,
              notes: `Produtos da nota fiscal. Método: ${invoicePaymentMethod}${isPaid ? ` - Pago em ${invoicePaymentDate}` : ` - Vence em ${dueDate}`}`
            })
            .select()
            .single();

          if (productsPayableError) {
            console.error('Erro ao criar conta a pagar de produtos:', productsPayableError);
            toast.error('Estoque lançado, mas houve erro ao criar conta a pagar de produtos');
          } else if (isPaid && productsPayable) {
            // Usar data de pagamento da NF (salva no campo notes), não a data de hoje
            const { error: ptError } = await supabase
              .from('payment_transactions')
              .insert({
                account_payable_id: productsPayable.id,
                payment_date: invoicePaymentDate,
                amount: productsAmount,
                payment_method: invoicePaymentMethod,
                bank_account_id: launchPaymentData.bankAccountId || null,
                notes: `Pagamento - ${invoicePaymentMethod}`
              });
            if (ptError) {
              console.error('Erro ao registrar pagamento de produtos:', ptError);
              toast.error('Conta marcada como paga, mas o pagamento não entrou no Fluxo de Caixa — corrija em Contas a Pagar.');
            }
          }
        }
        
        // 2. CONTA A PAGAR - FRETE (vinculada ao centro de custo de logística)
        if (freightAmount > 0) {
          const freightCostCenterId = invoice.freight_cost_center_id;
          
          // Buscar conta contábil 5.2.3 - Frete e Logística
          const { data: freightAccount } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('code', '5.2.3')
            .single();

          const { data: freightPayable, error: freightPayableError } = await supabase
            .from('accounts_payable')
            .insert({
              supplier_id: invoice.suppliers.id,
              invoice_number: `${invoice.invoice_number}-FRETE`,
              document_number: invoice.invoice_number,
              description: `NF ${invoice.invoice_number} - Frete/Tele-entrega`,
              issue_date: invoice.invoice_date || currentDate,
              due_date: dueDate,
              original_amount: freightAmount,
              remaining_amount: isPaid ? 0 : freightAmount,
              paid_amount: isPaid ? freightAmount : 0,
              payment_date: isPaid ? invoicePaymentDate : null,
              discount_amount: 0,
              interest_amount: 0,
              status: isPaid ? 'Pago' : 'Pendente',
              cost_center_id: freightCostCenterId,
              source_type: 'purchase_invoice_freight',
              source_id: invoiceId,
              account_id: freightAccount?.id || null,
              notes: `Frete/Tele-entrega da nota fiscal ${invoice.invoice_number}. Método: ${invoicePaymentMethod}${isPaid ? ' - Pago automaticamente' : ''}`
            })
            .select()
            .single();

          if (freightPayableError) {
            console.error('Erro ao criar conta a pagar de frete:', freightPayableError);
            toast.error('Conta de produtos criada, mas houve erro ao criar conta de frete');
          } else if (isPaid && freightPayable) {
            // Usar data de pagamento da NF (salva no campo notes), não a data de hoje
            const { error: ptError } = await supabase
              .from('payment_transactions')
              .insert({
                account_payable_id: freightPayable.id,
                payment_date: invoicePaymentDate,
                amount: freightAmount,
                payment_method: invoicePaymentMethod,
                bank_account_id: launchPaymentData.bankAccountId || null,
                notes: `Frete - ${invoicePaymentMethod}`
              });
            if (ptError) {
              console.error('Erro ao registrar pagamento de frete:', ptError);
              toast.error('Conta de frete marcada como paga, mas o pagamento não entrou no Fluxo de Caixa — corrija em Contas a Pagar.');
            }
          }
        }
      }

      // Marcar nota fiscal como lançada: atualiza status baseado na condição de pagamento
      const finalStatus = (paymentData.createPayable && invoicePaymentStatus === 'pago') ? 'Pago' : 'Pendente';
      const { error: updateError } = await supabase
        .from('purchase_invoices')
        .update({
          stock_posted: true,
          stock_posted_at: new Date().toISOString(),
          workflow_status: 'lancada',
          status: finalStatus
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Fecha a rastreabilidade: NF vinculada a um Pedido de Compra o marca como recebido
      if (invoice.purchase_order_id) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({ status: 'Recebido' })
          .eq('id', invoice.purchase_order_id);
        if (poError) {
          console.error('Erro ao marcar pedido de compra como recebido:', poError);
          toast.error('Estoque lançado, mas houve erro ao marcar o pedido de compra como recebido');
        }
      }

      let successMessage = 'Nota fiscal lançada no estoque com sucesso';
      if (paymentData.createPayable) {
        successMessage = finalStatus === 'Pago'
          ? 'Nota fiscal lançada no estoque e conta marcada como PAGA com sucesso'
          : 'Nota fiscal lançada no estoque e conta a pagar criada com sucesso';
      }
      
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['existing-payables'] });
      if (invoice.purchase_order_id) {
        queryClient.invalidateQueries({ queryKey: ['open-purchase-orders-for-invoice'] });
      }
      onRefresh();
    } catch (error) {
      console.error('Erro ao lançar no estoque:', error);
      toast.error(`Erro ao lançar no estoque: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const invoiceHasPayable = (invoice: any) => {
    return existingPayables.some(payable => 
      payable.invoice_number === invoice.invoiceNumber && 
      payable.supplier_id === invoice.supplier?.id
    );
  };

  const handleRetroactivePayableCreation = async (invoice: any) => {
    setSelectedInvoiceForRetroactive(invoice);
    setShowRetroactiveDialog(true);
    setRetroactivePaymentData({
      paymentMethod: 'Dinheiro',
      responsiblePerson: '',
      paymentDate: todayLocalISO()
    });
  };

  const createRetroactivePayable = async () => {
    if (!selectedInvoiceForRetroactive) return;

    try {
      setLoading(true);
      const currentDate = todayLocalISO();
      const dueDate = retroactivePaymentData.paymentDate;
      const invoiceAmount = parseFloat(selectedInvoiceForRetroactive.totalAmount?.toString() || '0');
      
      // Verificar se deve ser criada como paga
      const isPaid = dueDate <= currentDate;
      
      const { data: payableAccount, error: payableError } = await supabase
        .from('accounts_payable')
        .insert({
          supplier_id: selectedInvoiceForRetroactive.supplier?.id,
          invoice_number: selectedInvoiceForRetroactive.invoiceNumber,
          document_number: selectedInvoiceForRetroactive.invoiceNumber,
          description: `Nota fiscal ${selectedInvoiceForRetroactive.invoiceNumber} - ${selectedInvoiceForRetroactive.supplier?.companyName}`,
          issue_date: selectedInvoiceForRetroactive.invoiceDate || currentDate,
          due_date: dueDate,
          original_amount: invoiceAmount,
          remaining_amount: isPaid ? 0 : invoiceAmount,
          paid_amount: isPaid ? invoiceAmount : 0,
          discount_amount: 0,
          interest_amount: 0,
          status: isPaid ? 'Pago' : 'Pendente',
          notes: `Gerado retroativamente para nota já lançada. Método: ${retroactivePaymentData.paymentMethod}${retroactivePaymentData.responsiblePerson ? `, Responsável: ${retroactivePaymentData.responsiblePerson}` : ''}${isPaid ? ' - Pago automaticamente (vencimento até a data atual)' : ''}`
        })
        .select()
        .single();

      if (payableError) throw payableError;

      // Se foi marcada como paga, criar transação de pagamento com a data real informada
      if (isPaid && payableAccount) {
        const { error: paymentError } = await supabase
          .from('payment_transactions')
          .insert({
            account_payable_id: payableAccount.id,
            payment_date: retroactivePaymentData.paymentDate,
            amount: invoiceAmount,
            payment_method: retroactivePaymentData.paymentMethod,
            notes: `Pagamento retroativo - ${retroactivePaymentData.paymentMethod}${retroactivePaymentData.responsiblePerson ? ` - Responsável: ${retroactivePaymentData.responsiblePerson}` : ''}`
          });

        if (paymentError) {
          console.error('Erro ao criar transação de pagamento:', paymentError);
        }
      }

      const successMessage = isPaid 
        ? 'Conta a pagar criada e marcada como PAGA com sucesso'
        : 'Conta a pagar criada com sucesso';
      
      toast.success(successMessage);
      setShowRetroactiveDialog(false);
      setSelectedInvoiceForRetroactive(null);
      queryClient.invalidateQueries({ queryKey: ['existing-payables'] }); // Atualizar lista de contas existentes
      onRefresh();

    } catch (error) {
      console.error('Erro ao criar conta a pagar retroativa:', error);
      toast.error('Erro ao criar conta a pagar');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: PurchaseInvoice['status']) => {
    switch (status) {
      case 'Pago': return 'default';
      case 'Pendente': return 'secondary';
      case 'Vencido': return 'destructive';
      case 'Cancelado': return 'outline';
      default: return 'secondary';
    }
  };

  const getWorkflowStatusBadge = (workflowStatus?: string) => {
    switch (workflowStatus) {
      case 'rascunho':
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
            <FileEdit className="h-3 w-3 mr-1" />
            Rascunho
          </Badge>
        );
      case 'pendente':
        return (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando Lançamento
          </Badge>
        );
      case 'lancada':
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            <Package className="h-3 w-3 mr-1" />
            Lançada no Estoque
          </Badge>
        );
      default:
        return null;
    }
  };

  // Classificação: NF "precisa de ação" se não concluiu o fluxo
  // Uma NF lançada com AP existente (Pendente de pagamento) NÃO é "requer ação"
  const needsAction = (inv: PurchaseInvoice) =>
    inv.workflowStatus !== 'lancada' ||
    !inv.stockPosted ||
    (inv.status === 'Pendente' && !invoiceHasPayable(inv));

  const pendingInvoices = invoices.filter(needsAction);
  const completedInvoices = invoices.filter(inv => !needsAction(inv));

  const filteredHistory = completedInvoices.filter(inv => {
    const supplierOk = !historyFilters.supplierId || inv.supplier?.id === historyFilters.supplierId;
    const periodOk = !historyFilters.period || inv.invoiceDate.startsWith(historyFilters.period);
    return supplierOk && periodOk;
  });

  const displayedInvoices = viewMode === 'pending' ? pendingInvoices : filteredHistory;

  // Componente inline de progresso por NF (3 etapas)
  const InvoiceProgress = ({ inv }: { inv: PurchaseInvoice }) => {
    const steps = [
      { label: 'Efetivada',  done: inv.workflowStatus === 'lancada' || inv.workflowStatus === 'pendente' },
      { label: 'Estoque',    done: inv.stockPosted },
      { label: 'Financeiro', done: invoiceHasPayable(inv) },
    ];
    return (
      <div className="flex items-center gap-1 mt-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1">
            {step.done
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <Circle className="h-3.5 w-3.5 text-gray-300" />
            }
            <span className={`text-xs ${step.done ? 'text-green-600' : 'text-muted-foreground'}`}>{step.label}</span>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border mx-0.5" />}
          </div>
        ))}
      </div>
    );
  };

  if (roleLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!can('compras', 'view')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Notas Fiscais de Compra
          </CardTitle>
          <CardDescription>
            Acesso restrito — seu perfil de acesso não inclui o módulo Compras
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50">
            <Shield className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Acesso Restrito:</strong> Esta funcionalidade contém informações sensíveis de fornecedores e está disponível apenas para usuários com permissões de administrador ou gerente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Notas Fiscais de Compra
              </CardTitle>
              <CardDescription>
                Controle de entrada de mercadorias e atualização do estoque
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setPoPickerOpen(true); refetchOpenPOs(); }}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Lançar Pedido de Compra
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsOCRSheetOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar via OCR
              </Button>
              <Button size="sm" onClick={openNewInvoiceDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova NF
              </Button>
            </div>
          </div>

          {/* Toggle: Requer Ação | Histórico */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setViewMode('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'pending'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Requer Ação
              {pendingInvoices.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  viewMode === 'pending' ? 'bg-primary-foreground text-primary' : 'bg-orange-500 text-white'
                }`}>
                  {pendingInvoices.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'history'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Histórico
              <span className="ml-1 text-xs opacity-70">({completedInvoices.length})</span>
            </button>
          </div>

          {/* Filtros do histórico */}
          {viewMode === 'history' && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={historyFilters.supplierId} onValueChange={(v) => setHistoryFilters(f => ({ ...f, supplierId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="month"
                value={historyFilters.period}
                onChange={(e) => setHistoryFilters(f => ({ ...f, period: e.target.value }))}
                className="h-8 px-2 border rounded-md text-sm bg-background"
              />
              {(historyFilters.supplierId || historyFilters.period) && (
                <button
                  onClick={() => setHistoryFilters({ supplierId: '', period: '' })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {/* Dialog robusto de lançamento com todos os campos */}
          <InvoiceEditDialog
            open={isInvoiceDialogOpen}
            onOpenChange={(open) => {
              setIsInvoiceDialogOpen(open);
              if (!open) {
                setEditingInvoiceId(null);
                setEditingSupplierId(null);
                setEditingItemsLocked(false);
                setLinkedPurchaseOrder(null);
              }
            }}
            invoiceData={manualInvoiceData}
            onLaunch={handleInvoiceLaunch}
            onSaveDraft={onRefresh}
            formaPagamento="dinheiro"
            numeroParcelas={1}
            prazoPagamentoDias={30}
            invoiceId={editingInvoiceId}
            supplierId={editingSupplierId}
            isEditMode={!!editingInvoiceId}
            itemsLocked={editingItemsLocked}
            isAdmin={isAdmin()}
            purchaseOrderId={linkedPurchaseOrder?.id ?? null}
            purchaseOrderNumber={linkedPurchaseOrder?.order_number ?? null}
          />

          {/* Picker de Pedido de Compra em aberto pra iniciar a NF já preenchida */}
          <Dialog open={poPickerOpen} onOpenChange={setPoPickerOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Lançar Pedido de Compra</DialogTitle>
                <DialogDescription>
                  Selecione o pedido que chegou — fornecedor e itens serão pré-preenchidos na nota.
                </DialogDescription>
              </DialogHeader>
              {loadingPOs ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
              ) : openPurchaseOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum pedido de compra aprovado/enviado sem NF vinculada.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {openPurchaseOrders.map(order => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => openInvoiceFromPurchaseOrder(order)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div>
                        <div className="font-mono text-sm font-medium">{order.order_number}</div>
                        <div className="text-sm text-muted-foreground">{order.supplier_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {displayedInvoices.length === 0 ? (
            <div className="text-center py-10">
              {viewMode === 'pending' ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                  <p className="font-medium text-green-700">Tudo em dia!</p>
                  <p className="text-sm text-muted-foreground mt-1">Nenhuma nota aguarda ação.</p>
                </>
              ) : (
                <>
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma nota concluída encontrada.</p>
                  {(historyFilters.supplierId || historyFilters.period) && (
                    <button
                      onClick={() => setHistoryFilters({ supplierId: '', period: '' })}
                      className="text-sm text-primary mt-2 hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedInvoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-medium">Nota #{invoice.invoiceNumber}</h3>
                      {invoice.itemsLocked && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Bloqueada
                        </Badge>
                      )}
                    </div>
                    <InvoiceProgress inv={invoice} />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="block font-medium text-foreground">
                          {invoice.supplier?.companyName || 'Sem fornecedor'}
                        </span>
                        <span>Fornecedor</span>
                      </div>
                       <div>
                         <span className="block font-medium text-foreground">
                           {new Date(invoice.invoiceDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                         </span>
                         <span>Data da Nota</span>
                       </div>
                      <div>
                        <span className="block font-medium text-foreground">
                          R$ {invoice.totalAmount.toFixed(2)}
                        </span>
                        <span>Valor Total</span>
                      </div>
                    </div>
                  </div>
                   <div className="flex flex-col gap-2 ml-4">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         if (invoice.workflowStatus !== 'rascunho') {
                           setLockedInvoiceIdToEdit(invoice.id);
                           setShowEditLockedDialog(true);
                         } else {
                           startEditInvoice(invoice.id);
                         }
                       }}
                       className="flex items-center gap-2"
                     >
                       {invoice.workflowStatus !== 'rascunho'
                         ? <Lock className="h-4 w-4" />
                         : <FileText className="h-4 w-4" />}
                       Editar
                     </Button>
                     {invoice.workflowStatus !== 'lancada' && !invoice.stockPosted && (
                       <Button
                         variant="default"
                         onClick={(e) => { e.stopPropagation(); openLaunchConfirm(invoice); }}
                         size="sm"
                         disabled={loading || launchConfirmLoading}
                         className="flex items-center gap-2"
                       >
                         <Package className="h-4 w-4" />
                         Lançar no Estoque
                       </Button>
                     )}
                     {(invoice.workflowStatus === 'lancada' || invoice.stockPosted) && !invoiceHasPayable(invoice) && (
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleRetroactivePayableCreation(invoice)}
                         disabled={loading}
                         className="flex items-center gap-2"
                       >
                         <CreditCard className="h-4 w-4" />
                         Gerar Conta a Pagar
                       </Button>
                     )}
                     <Button
                       variant="destructive"
                       size="sm"
                       onClick={() => deleteInvoice(invoice.id)}
                       disabled={loading}
                       className="flex items-center gap-2"
                     >
                       <Trash2 className="h-4 w-4" />
                       Excluir
                     </Button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet lateral para importação via OCR */}
      <Sheet open={isOCRSheetOpen} onOpenChange={setIsOCRSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Nota Fiscal via OCR
            </SheetTitle>
          </SheetHeader>
          <InvoiceOCRUploader onCreated={() => { setIsOCRSheetOpen(false); onRefresh(); }} />
        </SheetContent>
      </Sheet>

      {/* As condições de pagamento agora são preenchidas no formulário da NF */}

      {/* Confirmação antes de lançar — última checagem humana antes de gravar
          estoque + financeiro (esse clique hoje comitava tudo direto, sem revisão). */}
      <Dialog open={!!launchConfirm} onOpenChange={(open) => !open && setLaunchConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Confirmar lançamento no estoque
            </DialogTitle>
            <DialogDescription>
              Revise antes de gravar — essa ação move o estoque e cria o lançamento financeiro.
            </DialogDescription>
          </DialogHeader>
          {launchConfirm && (
            <div className="space-y-2 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fornecedor</span>
                <span className="font-medium">{launchConfirm.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nota</span>
                <span className="font-medium">{launchConfirm.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Itens</span>
                <span className="font-medium">{launchConfirm.itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-medium">R$ {launchConfirm.totalAmount.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagamento</span>
                <span className="font-medium">
                  {launchConfirm.isPaid
                    ? `Pago em ${launchConfirm.paymentDate ? formatLocalDate(launchConfirm.paymentDate) : '—'}`
                    : `A vencer em ${launchConfirm.dueDate ? formatLocalDate(launchConfirm.dueDate) : '—'}`}
                </span>
              </div>
              {launchConfirm.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forma</span>
                  <span className="font-medium">{launchConfirm.paymentMethod}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setLaunchConfirm(null)}>Cancelar</Button>
            <Button
              disabled={loading}
              onClick={() => {
                const id = launchConfirm!.id;
                setLaunchConfirm(null);
                postToStock(id);
              }}
            >
              <Package className="h-4 w-4 mr-2" /> Confirmar e Lançar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para criar conta a pagar retroativa — REMOVIDO TEMPORARIAMENTE */}
      {false && <Dialog open={showPaymentConditionDialog} onOpenChange={setShowPaymentConditionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Condição de Pagamento
            </DialogTitle>
            <DialogDescription>
              Informe como esta nota foi ou será paga antes de lançar no estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo: Já pago ou A pagar */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status do pagamento</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'pago',    label: '✅ Já foi pago',      desc: 'Pagamento já realizado' },
                  { value: 'a_pagar', label: '📅 A vencer / Boleto', desc: 'Ainda precisa pagar' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLaunchPaymentData(p => ({ ...p, paymentStatus: opt.value as 'pago'|'a_pagar' }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      launchPaymentData.paymentStatus === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data de pagamento ou vencimento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                  {launchPaymentData.paymentStatus === 'pago' ? 'Data do Pagamento' : 'Data de Vencimento'}
                </label>
                <input
                  type="date"
                  value={launchPaymentData.paymentStatus === 'pago' ? launchPaymentData.paymentDate : launchPaymentData.dueDate}
                  onChange={e => setLaunchPaymentData(p =>
                    p.paymentStatus === 'pago'
                      ? { ...p, paymentDate: e.target.value }
                      : { ...p, dueDate: e.target.value }
                  )}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={launchPaymentData.paymentMethod}
                  onChange={e => setLaunchPaymentData(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                >
                  {paymentMethodNames.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                Observações (opcional)
              </label>
              <input
                type="text"
                value={launchPaymentData.notes}
                onChange={e => setLaunchPaymentData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Ex: NF paga via PIX em 15/05, ref. pedido 1234..."
                className="w-full border rounded px-2 py-1.5 text-sm bg-background"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowPaymentConditionDialog(false)}
              className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmAndLaunch}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Lançando...' : 'Confirmar e Lançar no Estoque'}
            </button>
          </div>
        </DialogContent>
      </Dialog>}

      {/* Dialog para criar conta a pagar retroativa */}
      <Dialog open={showRetroactiveDialog} onOpenChange={setShowRetroactiveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Conta a Pagar</DialogTitle>
            <DialogDescription>
              Criar conta a pagar para a nota fiscal #{selectedInvoiceForRetroactive?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="retroactive-payment-method">Forma de Pagamento *</Label>
              <Select
                value={retroactivePaymentData.paymentMethod}
                onValueChange={(value) => setRetroactivePaymentData(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodNames.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="retroactive-responsible">Responsável</Label>
              <Input
                id="retroactive-responsible"
                placeholder="Nome do responsável pelo pagamento"
                value={retroactivePaymentData.responsiblePerson}
                onChange={(e) => setRetroactivePaymentData(prev => ({ ...prev, responsiblePerson: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="retroactive-due-date">Data de Vencimento *</Label>
              <Input
                id="retroactive-due-date"
                type="date"
                value={retroactivePaymentData.paymentDate}
                onChange={(e) => setRetroactivePaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {retroactivePaymentData.paymentDate <= todayLocalISO() 
                  ? '✅ Será criada como PAGA (vencimento hoje ou anterior)'
                  : '⏳ Será criada como PENDENTE (vencimento futuro)'
                }
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowRetroactiveDialog(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={createRetroactivePayable} disabled={loading} className="flex-1">
              <CreditCard className="h-4 w-4 mr-2" />
              {loading ? 'Criando...' : 'Criar Conta a Pagar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar nota fiscal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Nota Fiscal</DialogTitle>
            <DialogDescription>
              Edite os dados da nota fiscal #{editingInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-invoice-number">Número da Nota *</Label>
                <Input
                  id="edit-invoice-number"
                  value={editFormData.invoiceNumber}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="Ex: 12345"
                />
              </div>
              <div>
                <Label htmlFor="edit-invoice-date">Data da Nota *</Label>
                <Input
                  id="edit-invoice-date"
                  type="date"
                  value={editFormData.invoiceDate}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label htmlFor="edit-payment-method">Forma de Pagamento *</Label>
              <Select
                value={editFormData.formaPagamento}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, formaPagamento: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodNames.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-parcelas">Número de Parcelas</Label>
                <Input
                  id="edit-parcelas"
                  type="number"
                  min="1"
                  value={editFormData.numeroParcelas}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, numeroParcelas: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-prazo">Prazo de Pagamento (dias)</Label>
                <Input
                  id="edit-prazo"
                  type="number"
                  min="0"
                  value={editFormData.prazoPagamentoDias}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, prazoPagamentoDias: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Adicione observações sobre esta nota fiscal..."
                rows={4}
              />
            </div>

            {editingInvoice?.stock_posted && (
              <Alert>
                <AlertDescription>
                  ℹ️ Esta nota já foi lançada no estoque. As alterações não afetarão os dados de estoque já registrados.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false);
                setEditingInvoice(null);
              }} 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveEditedInvoice} 
              disabled={loading || !editFormData.invoiceNumber || !editFormData.invoiceDate || !editFormData.formaPagamento} 
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: restrição de edição de NF lançada */}
      <Dialog
        open={showEditLockedDialog}
        onOpenChange={(open) => {
          setShowEditLockedDialog(open);
          if (!open) { setLockedInvoiceIdToEdit(null); setAdminPassword(''); setAdminAuthError(''); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Nota Fiscal Bloqueada
            </DialogTitle>
          </DialogHeader>

          <Alert variant="destructive" className="border-orange-200 bg-orange-50 text-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              Esta NF já foi lançada no estoque e gerou registros financeiros.
              Edições <strong>não revertem</strong> movimentações de estoque nem contas a pagar já criadas.
              Para corrigir valores ou itens, exclua e relance a nota.
            </AlertDescription>
          </Alert>

          {isAdmin() ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Como administrador, você pode editar mediante confirmação de senha.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Senha de administrador</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  placeholder="Digite sua senha"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminAuthError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdminEditAuth(); }}
                  autoFocus
                />
                {adminAuthError && (
                  <p className="text-sm text-destructive">{adminAuthError}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setShowEditLockedDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!adminPassword || isAuthenticating}
                  onClick={handleAdminEditAuth}
                >
                  {isAuthenticating ? 'Verificando...' : 'Confirmar e Editar'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Apenas administradores podem editar notas fiscais já lançadas.
                Entre em contato com o administrador para solicitar uma correção.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setShowEditLockedDialog(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
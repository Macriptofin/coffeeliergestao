import { useState, useEffect } from "react";
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
import { FileText, Plus, ShoppingCart, X, Package, Shield, Trash2, CreditCard, FileEdit, Lock, Clock } from "lucide-react";
import type { PurchaseInvoice } from "@/pages/Stock";
import { useUserRole } from "@/hooks/useUserRole";
import { InvoiceEditDialog } from "../purchase/InvoiceEditDialog";

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

export function PurchaseInvoices({ invoices, onRefresh }: PurchaseInvoicesProps) {
  const { isAdminOrManager, isAdmin, loading: roleLoading } = useUserRole();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [manualInvoiceData, setManualInvoiceData] = useState<any>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingItemsLocked, setEditingItemsLocked] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'Dinheiro',
    responsiblePerson: '',
    paymentDate: new Date().toISOString().split('T')[0],
    createPayable: true
  });
  const [retroactivePaymentData, setRetroactivePaymentData] = useState({
    paymentMethod: 'Dinheiro',
    responsiblePerson: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [showRetroactiveDialog, setShowRetroactiveDialog] = useState(false);
  const [selectedInvoiceForRetroactive, setSelectedInvoiceForRetroactive] = useState<any>(null);
  const [existingPayables, setExistingPayables] = useState<any[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    notes: '',
    formaPagamento: '',
    numeroParcelas: 1,
    prazoPagamentoDias: 30,
  });

  useEffect(() => {
    loadSuppliers();
    loadIngredients();
  }, []);

  useEffect(() => {
    if (invoices.length > 0) {
      checkExistingPayables();
    }
  }, [invoices]);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('status', 'Ativo')
        .order('company_name');

      if (error) throw error;

      setSuppliers(data.map(item => ({
        id: item.id,
        companyName: item.company_name
      })));
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      toast.error('Erro ao carregar fornecedores');
    }
  };

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, purchase_unit, usage_unit, conversion_factor')
        .order('name');

      if (error) throw error;

      setIngredients(data.map(item => ({
        id: item.id,
        name: item.name,
        purchaseUnit: item.purchase_unit,
        usageUnit: item.usage_unit,
        conversionFactor: parseFloat(item.conversion_factor?.toString() || '1')
      })));
    } catch (error) {
      console.error('Erro ao carregar ingredientes:', error);
      toast.error('Erro ao carregar ingredientes');
    }
  };

  const openNewInvoiceDialog = () => {
    // Abrir diálogo vazio para nova nota fiscal
    const emptyInvoiceData = {
      fornecedor: '',
      data: new Date().toISOString().split('T')[0],
      numero_nota: '',
      itens: []
    };
    
    setManualInvoiceData(emptyInvoiceData);
    setEditingInvoiceId(null);
    setEditingSupplierId(null);
    setEditingItemsLocked(false);
    setIsInvoiceDialogOpen(true);
  };

  const handleInvoiceLaunch = () => {
    setIsInvoiceDialogOpen(false);
    setManualInvoiceData(null);
    setEditingInvoiceId(null);
    setEditingSupplierId(null);
    setEditingItemsLocked(false);
    onRefresh();
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
          preco_total: (item.quantity || 0) * (item.unit_price || 0),
          desconto: item.discount_amount || 0,
          material_id: item.material_id,
          material_nome: item.materials?.name,
          material_codigo: item.materials?.code,
          status: item.material_id ? 'matched' : 'not_found',
          conversion_factor: item.conversion_factor || 1,
          usage_unit: item.materials?.usage_unit || item.unit,
          converted_quantity: item.converted_quantity || item.quantity,
          converted_unit_price: item.converted_unit_price || item.unit_price
        })),
        discount_total: invoice.discount_total || 0
      };

      setManualInvoiceData(invoiceData);
      setEditingInvoiceId(invoiceId);
      setEditingSupplierId(invoice.supplier_id);
      setEditingItemsLocked(invoice.items_locked || false);
      setIsInvoiceDialogOpen(true);
    } catch (error) {
      console.error('Erro ao carregar nota fiscal:', error);
      toast.error('Erro ao carregar dados da nota fiscal');
    } finally {
      setLoading(false);
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

      toast.success('Nota fiscal atualizada com sucesso');
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

        // Recalcular estoques afetados usando quantidades negativas para reverter
        if (movements) {
          for (const movement of movements) {
            // Usar quantidade negativa para reverter a entrada anterior
            await supabase.rpc('calculate_weighted_average_price', {
              p_material_id: movement.material_id,
              p_new_quantity: -parseFloat(movement.quantity?.toString() || '0'),
              p_new_price: parseFloat(movement.unit_price?.toString() || '0')
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
          suppliers:supplier_id (
            id,
            company_name
          )
        `)
        .eq('id', invoiceId)
        .single();

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
            conversion_factor
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
        
        // Calcular quantidade em unidade de uso
        const conversionFactor = parseFloat(material.conversion_factor?.toString() || '1');
        const usageQuantity = parseFloat(item.quantity?.toString() || '0') * conversionFactor;
        const usageUnitPrice = parseFloat(item.unit_price?.toString() || '0') / conversionFactor;
        
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
            notes: `Nota fiscal ${invoice.invoice_number} - Compra: ${item.quantity} ${material.purchase_unit} = ${usageQuantity} ${material.usage_unit}`
          });

        if (stockError) {
          console.error('Erro ao criar movimentação de estoque:', stockError);
          throw stockError;
        }

        // Atualizar preço médio ponderado
        const { error: rpcError } = await supabase.rpc('calculate_weighted_average_price', {
          p_material_id: item.material_id,
          p_new_quantity: usageQuantity,
          p_new_price: usageUnitPrice
        });

        if (rpcError) {
          console.error('Erro no RPC calculate_weighted_average_price:', rpcError);
          throw rpcError;
        }
      }

      // Criar contas a pagar se configurado
      if (paymentData.createPayable) {
        const currentDate = new Date().toISOString().split('T')[0];
        const dueDate = paymentData.paymentDate;
        const totalAmount = parseFloat(invoice.total_amount?.toString() || '0');
        const freightAmount = parseFloat(invoice.freight_amount?.toString() || '0');
        const productsAmount = totalAmount - freightAmount;
        
        // Verificar se deve ser criada como paga (data de vencimento igual ou anterior à data atual)
        const isPaid = dueDate <= currentDate;
        
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
              discount_amount: parseFloat(invoice.discount_total?.toString() || '0'),
              interest_amount: 0,
              status: isPaid ? 'Pago' : 'Pendente',
              source_type: 'purchase_invoice',
              source_id: invoiceId,
              account_id: purchaseAccount?.id || null,
              notes: `Produtos da nota fiscal. Método: ${paymentData.paymentMethod}${paymentData.responsiblePerson ? `, Responsável: ${paymentData.responsiblePerson}` : ''}${isPaid ? ' - Pago automaticamente' : ''}`
            })
            .select()
            .single();

          if (productsPayableError) {
            console.error('Erro ao criar conta a pagar de produtos:', productsPayableError);
            toast.error('Estoque lançado, mas houve erro ao criar conta a pagar de produtos');
          } else if (isPaid && productsPayable) {
            // Criar transação de pagamento para produtos
            await supabase
              .from('payment_transactions')
              .insert({
                account_payable_id: productsPayable.id,
                payment_date: currentDate,
                amount: productsAmount,
                payment_method: paymentData.paymentMethod,
                notes: `Pagamento automático - Produtos - ${paymentData.paymentMethod}`
              });
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
              discount_amount: 0,
              interest_amount: 0,
              status: isPaid ? 'Pago' : 'Pendente',
              cost_center_id: freightCostCenterId,
              source_type: 'purchase_invoice_freight',
              source_id: invoiceId,
              account_id: freightAccount?.id || null,
              notes: `Frete/Tele-entrega da nota fiscal ${invoice.invoice_number}. Método: ${paymentData.paymentMethod}${isPaid ? ' - Pago automaticamente' : ''}`
            })
            .select()
            .single();

          if (freightPayableError) {
            console.error('Erro ao criar conta a pagar de frete:', freightPayableError);
            toast.error('Conta de produtos criada, mas houve erro ao criar conta de frete');
          } else if (isPaid && freightPayable) {
            // Criar transação de pagamento para frete
            await supabase
              .from('payment_transactions')
              .insert({
                account_payable_id: freightPayable.id,
                payment_date: currentDate,
                amount: freightAmount,
                payment_method: paymentData.paymentMethod,
                notes: `Pagamento automático - Frete - ${paymentData.paymentMethod}`
              });
          }
        }
      }

      // Marcar nota fiscal como lançada no estoque
      const { error: updateError } = await supabase
        .from('purchase_invoices')
        .update({
          stock_posted: true,
          stock_posted_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      const currentDate = new Date().toISOString().split('T')[0];
      const isPaid = paymentData.createPayable && paymentData.paymentDate <= currentDate;
      
      let successMessage = 'Nota fiscal lançada no estoque com sucesso';
      if (paymentData.createPayable) {
        successMessage = isPaid 
          ? 'Nota fiscal lançada no estoque e conta marcada como PAGA com sucesso'
          : 'Nota fiscal lançada no estoque e conta a pagar criada com sucesso';
      }
      
      toast.success(successMessage);
      onRefresh();
    } catch (error) {
      console.error('Erro ao lançar no estoque:', error);
      toast.error(`Erro ao lançar no estoque: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Verificar quais notas já possuem contas a pagar
  const checkExistingPayables = async () => {
    const invoiceNumbers = invoices.map(inv => inv.invoiceNumber);
    const { data: existingPayables } = await supabase
      .from('accounts_payable')
      .select('invoice_number, supplier_id')
      .in('invoice_number', invoiceNumbers);
    
    setExistingPayables(existingPayables || []);
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
      paymentDate: new Date().toISOString().split('T')[0]
    });
  };

  const createRetroactivePayable = async () => {
    if (!selectedInvoiceForRetroactive) return;

    try {
      setLoading(true);
      const currentDate = new Date().toISOString().split('T')[0];
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

      // Se foi marcada como paga, criar transação de pagamento
      if (isPaid && payableAccount) {
        const { error: paymentError } = await supabase
          .from('payment_transactions')
          .insert({
            account_payable_id: payableAccount.id,
            payment_date: currentDate,
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
      checkExistingPayables(); // Atualizar lista de contas existentes
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

  if (roleLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isAdminOrManager()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Notas Fiscais de Compra
          </CardTitle>
          <CardDescription>
            Acesso restrito a administradores e gerentes
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Notas Fiscais de Compra
              </CardTitle>
              <CardDescription>
                Controle de entrada de mercadorias e atualização automática do estoque
              </CardDescription>
            </div>
            <Button 
              onClick={openNewInvoiceDialog}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Nota Fiscal
            </Button>

            {/* Dialog robusto de lançamento com todos os campos */}
            <InvoiceEditDialog
              open={isInvoiceDialogOpen}
              onOpenChange={(open) => {
                setIsInvoiceDialogOpen(open);
                if (!open) {
                  setEditingInvoiceId(null);
                  setEditingSupplierId(null);
                  setEditingItemsLocked(false);
                }
              }}
              invoiceData={manualInvoiceData}
              onLaunch={handleInvoiceLaunch}
              formaPagamento="dinheiro"
              numeroParcelas={1}
              prazoPagamentoDias={30}
              invoiceId={editingInvoiceId}
              supplierId={editingSupplierId}
              isEditMode={!!editingInvoiceId}
              itemsLocked={editingItemsLocked}
              isAdmin={isAdmin()}
            />
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma nota fiscal cadastrada</p>
              <p className="text-sm text-muted-foreground">
                Cadastre notas fiscais para controlar entradas no estoque
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-medium">Nota #{invoice.invoiceNumber}</h3>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      {getWorkflowStatusBadge(invoice.workflowStatus)}
                      {invoice.itemsLocked && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                          <Lock className="h-3 w-3 mr-1" />
                          Bloqueada
                        </Badge>
                      )}
                    </div>
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
                       onClick={() => startEditInvoice(invoice.id)}
                       className="flex items-center gap-2"
                     >
                       <FileText className="h-4 w-4" />
                       Editar
                     </Button>
                     {invoice.workflowStatus !== 'lancada' && !invoice.stockPosted && (
                       <Button
                         variant="default"
                         size="sm"
                         onClick={() => postToStock(invoice.id)}
                         disabled={loading}
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
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
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
                {retroactivePaymentData.paymentDate <= new Date().toISOString().split('T')[0] 
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
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
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
    </div>
  );
}
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
import { FileText, Plus, ShoppingCart, X, Package, Shield, Trash2, CreditCard } from "lucide-react";
import type { PurchaseInvoice } from "@/pages/Stock";
import { useUserRole } from "@/hooks/useUserRole";

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
  const { isAdminOrManager, loading: roleLoading } = useUserRole();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    supplierId: '',
    supplierName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    totalAmount: 0,
    notes: ''
  });
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
  const [currentItem, setCurrentItem] = useState({
    ingredientName: '',
    purchaseUnit: '',
    quantity: 0,
    unitPrice: 0
  });
  const [loading, setLoading] = useState(false);

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

  const handleSupplierChange = (value: string) => {
    const existingSupplier = suppliers.find(s => s.companyName === value);
    
    if (existingSupplier) {
      setFormData(prev => ({ 
        ...prev, 
        supplierId: existingSupplier.id,
        supplierName: value 
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        supplierId: '',
        supplierName: value 
      }));
    }
  };


  const addItemToInvoice = () => {
    if (!currentItem.ingredientName || !currentItem.purchaseUnit || !currentItem.quantity || !currentItem.unitPrice) {
      toast.error('Preencha todos os campos do item');
      return;
    }

    const selectedIngredient = ingredients.find(ing => ing.name === currentItem.ingredientName);

    if (!selectedIngredient) {
      toast.error('Ingrediente não encontrado no cadastro. Cadastre o ingrediente antes de incluí-lo na nota fiscal.');
      return;
    }

    const totalPrice = currentItem.quantity * currentItem.unitPrice;
    const newItem: InvoiceItem = {
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      quantity: currentItem.quantity,
      purchaseUnit: currentItem.purchaseUnit,
      unitPrice: currentItem.unitPrice,
      totalPrice
    };

    setInvoiceItems(prev => [...prev, newItem]);
    setCurrentItem({ ingredientName: '', purchaseUnit: '', quantity: 0, unitPrice: 0 });
    
    const newTotal = [...invoiceItems, newItem].reduce((sum, item) => sum + item.totalPrice, 0);
    setFormData(prev => ({ ...prev, totalAmount: newTotal }));
  };

  const removeItemFromInvoice = (index: number) => {
    const newItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(newItems);
    
    const newTotal = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setFormData(prev => ({ ...prev, totalAmount: newTotal }));
  };

  const handleSubmit = async () => {
    if (!formData.invoiceNumber || !formData.supplierId || invoiceItems.length === 0) {
      toast.error('Preencha os campos obrigatórios e adicione pelo menos um item. O fornecedor deve estar cadastrado no sistema.');
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe uma nota fiscal com o mesmo número e fornecedor (apenas para novas notas)
      if (!editingInvoice) {
        const { data: existingInvoice, error: checkInvoiceError } = await supabase
          .from('purchase_invoices')
          .select('id, invoice_number, supplier_id')
          .eq('invoice_number', formData.invoiceNumber)
          .eq('supplier_id', formData.supplierId)
          .maybeSingle();

        if (checkInvoiceError) {
          throw checkInvoiceError;
        }

        if (existingInvoice) {
          const supplierName = suppliers.find(s => s.id === formData.supplierId)?.companyName || 'Fornecedor';
          toast.error(`Nota fiscal ${formData.invoiceNumber} do ${supplierName} já foi cadastrada no sistema`);
          setLoading(false);
          return;
        }
      }

      if (editingInvoice) {
        // Atualizar nota fiscal existente
        const { error: invoiceError } = await supabase
          .from('purchase_invoices')
          .update({
            invoice_number: formData.invoiceNumber,
            supplier_id: formData.supplierId,
            invoice_date: formData.invoiceDate,
            due_date: formData.dueDate || null,
            total_amount: formData.totalAmount,
            notes: formData.notes || null
          })
          .eq('id', editingInvoice);

        if (invoiceError) {
          console.error('Erro ao atualizar nota fiscal:', invoiceError);
          throw invoiceError;
        }

        // Remover itens existentes e inserir novos
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice);

        const invoiceItemsData = invoiceItems.map(item => ({
          invoice_id: editingInvoice,
          material_id: item.ingredientId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItemsData);

        if (itemsError) {
          console.error('Erro ao atualizar itens da nota fiscal:', itemsError);
          throw itemsError;
        }

        toast.success('Nota fiscal atualizada com sucesso');
      } else {
        // Criar nova nota fiscal
        const { data: invoice, error: invoiceError } = await supabase
          .from('purchase_invoices')
          .insert({
            invoice_number: formData.invoiceNumber,
            supplier_id: formData.supplierId,
            invoice_date: formData.invoiceDate,
            due_date: formData.dueDate || null,
            total_amount: formData.totalAmount,
            notes: formData.notes || null,
            stock_posted: false
          })
          .select()
          .single();

        if (invoiceError) {
          console.error('Erro ao criar nota fiscal:', invoiceError);
          throw invoiceError;
        }

        const invoiceItemsData = invoiceItems.map(item => ({
          invoice_id: invoice.id,
          material_id: item.ingredientId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItemsData);

        if (itemsError) {
          console.error('Erro ao inserir itens da nota fiscal:', itemsError);
          throw itemsError;
        }

        toast.success('Nota fiscal criada com sucesso');
      }

      // Resetar formulário
      setShowForm(false);
      setEditingInvoice(null);
        setFormData({
          invoiceNumber: '',
          supplierId: '',
          supplierName: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: '',
          totalAmount: 0,
          notes: ''
        });
        setPaymentData({
          paymentMethod: 'Dinheiro',
          responsiblePerson: '',
          paymentDate: new Date().toISOString().split('T')[0],
          createPayable: true
        });
        setInvoiceItems([]);
        setCurrentItem({ ingredientName: '', purchaseUnit: '', quantity: 0, unitPrice: 0 });
      onRefresh();
    } catch (error) {
      console.error('Erro ao processar nota fiscal:', error);
      toast.error(`Erro ao processar nota fiscal: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditInvoice = async (invoiceId: string) => {
    try {
      // Carregar dados da nota fiscal
      const { data: invoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          suppliers:supplier_id (
            id,
            company_name,
            cnpj_cpf,
            contact_name,
            email,
            phone,
            address,
            city,
            state,
            zip_code
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

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

      // Preencher formulário com dados da nota fiscal
      setEditingInvoice(invoiceId);
      setFormData({
        invoiceNumber: invoice.invoice_number,
        supplierId: invoice.supplier_id || '',
        supplierName: invoice.suppliers?.company_name || '',
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date || '',
        totalAmount: parseFloat(invoice.total_amount?.toString() || '0'),
        notes: invoice.notes || ''
      });


      // Preencher itens da nota fiscal
      const formattedItems: InvoiceItem[] = items.map(item => ({
        ingredientId: item.material_id,
        ingredientName: item.materials?.name || '',
        quantity: parseFloat(item.quantity?.toString() || '0'),
        purchaseUnit: item.materials?.purchase_unit || '',
        unitPrice: parseFloat(item.unit_price?.toString() || '0'),
        totalPrice: parseFloat(item.total_price?.toString() || '0')
      }));

      setInvoiceItems(formattedItems);
      setShowForm(true);
      
      toast.success('Nota fiscal carregada para edição');
    } catch (error) {
      console.error('Erro ao carregar nota fiscal:', error);
      toast.error('Erro ao carregar nota fiscal para edição');
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

      // Criar conta a pagar se configurado
      if (paymentData.createPayable) {
        const currentDate = new Date().toISOString().split('T')[0];
        const dueDate = paymentData.paymentDate;
        const invoiceAmount = parseFloat(invoice.total_amount?.toString() || '0');
        
        // Verificar se deve ser criada como paga (data de vencimento igual ou anterior à data atual)
        const isPaid = dueDate <= currentDate;
        
        const { data: payableAccount, error: payableError } = await supabase
          .from('accounts_payable')
          .insert({
            supplier_id: invoice.suppliers.id,
            invoice_number: invoice.invoice_number,
            document_number: invoice.invoice_number,
            description: `Nota fiscal ${invoice.invoice_number} - ${invoice.suppliers.company_name}`,
            issue_date: invoice.invoice_date || currentDate,
            due_date: dueDate,
            original_amount: invoiceAmount,
            remaining_amount: isPaid ? 0 : invoiceAmount,
            paid_amount: isPaid ? invoiceAmount : 0,
            discount_amount: 0,
            interest_amount: 0,
            status: isPaid ? 'Pago' : 'Pendente',
            notes: `Gerado automaticamente do lançamento da nota fiscal. Método: ${paymentData.paymentMethod}${paymentData.responsiblePerson ? `, Responsável: ${paymentData.responsiblePerson}` : ''}${isPaid ? ' - Pago automaticamente (vencimento até a data atual)' : ''}`
          })
          .select()
          .single();

        if (payableError) {
          console.error('Erro ao criar conta a pagar:', payableError);
          // Não interrompe o processo, apenas alerta
          toast.error('Estoque lançado, mas houve erro ao criar conta a pagar');
        } else {
          // Se foi marcada como paga, criar transação de pagamento
          if (isPaid && payableAccount) {
            const { error: paymentError } = await supabase
              .from('payment_transactions')
              .insert({
                account_payable_id: payableAccount.id,
                payment_date: currentDate,
                amount: invoiceAmount,
                payment_method: paymentData.paymentMethod,
                notes: `Pagamento automático - ${paymentData.paymentMethod}${paymentData.responsiblePerson ? ` - Responsável: ${paymentData.responsiblePerson}` : ''}`
              });

            if (paymentError) {
              console.error('Erro ao criar transação de pagamento:', paymentError);
            }
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
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Nota Fiscal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingInvoice ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingInvoice 
                      ? 'Modifique os dados da nota fiscal conforme necessário'
                      : 'Cadastre uma nova nota fiscal de compra'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dados da Nota Fiscal</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="invoiceNumber">Número da Nota *</Label>
                        <Input
                          id="invoiceNumber"
                          value={formData.invoiceNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                          placeholder="Ex: 001234"
                        />
                      </div>
                       <div>
                         <Label htmlFor="supplier">Fornecedor *</Label>
                         <Select
                           value={formData.supplierId}
                           onValueChange={(value) => {
                             const supplier = suppliers.find(s => s.id === value);
                             setFormData(prev => ({
                               ...prev,
                               supplierId: value,
                               supplierName: supplier?.companyName || ''
                             }));
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Selecione um fornecedor cadastrado" />
                           </SelectTrigger>
                           <SelectContent>
                             {suppliers.map(supplier => (
                               <SelectItem key={supplier.id} value={supplier.id}>
                                 {supplier.companyName}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="invoiceDate">Data da Nota</Label>
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={formData.invoiceDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dueDate">Vencimento</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>


                   {!formData.supplierId && suppliers.length === 0 && (
                     <Alert className="border-amber-200 bg-amber-50">
                       <AlertDescription className="text-amber-800">
                         <strong>Atenção:</strong> Não há fornecedores cadastrados. Cadastre um fornecedor antes de criar a nota fiscal.
                       </AlertDescription>
                     </Alert>
                   )}

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Adicionar Itens</h3>
                     <div className="grid grid-cols-5 gap-3">
                       <div>
                         <Label htmlFor="ingredientName">Ingrediente *</Label>
                         <Select
                           value={currentItem.ingredientName}
                           onValueChange={(value) => {
                             const ingredient = ingredients.find(ing => ing.name === value);
                             setCurrentItem(prev => ({
                               ...prev,
                               ingredientName: value,
                               purchaseUnit: ingredient?.purchaseUnit || ''
                             }));
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Selecione um ingrediente cadastrado" />
                           </SelectTrigger>
                           <SelectContent>
                             {ingredients.map(ingredient => (
                               <SelectItem key={ingredient.id} value={ingredient.name}>
                                 {ingredient.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                      <div>
                        <Label htmlFor="purchaseUnit">Unidade Compra *</Label>
                        <Input
                          id="purchaseUnit"
                          value={currentItem.purchaseUnit}
                          onChange={(e) => setCurrentItem(prev => ({ ...prev, purchaseUnit: e.target.value }))}
                          placeholder="Ex: kg, L, un"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quantity">Quantidade *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.001"
                          value={currentItem.quantity || ''}
                          onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unitPrice">Preço Unitário *</Label>
                        <Input
                          id="unitPrice"
                          type="number"
                          step="0.0001"
                          value={currentItem.unitPrice || ''}
                          onChange={(e) => setCurrentItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,0000"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addItemToInvoice} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                    
                     {ingredients.length === 0 && (
                       <Alert className="border-amber-200 bg-amber-50">
                         <AlertDescription className="text-amber-800">
                           <strong>Atenção:</strong> Não há ingredientes cadastrados. Cadastre ingredientes antes de criar a nota fiscal.
                         </AlertDescription>
                       </Alert>
                     )}
                     
                     {currentItem.ingredientName && (
                       <div className="p-3 bg-muted rounded-lg">
                         <div className="text-sm">
                           <div className="font-medium text-green-700 dark:text-green-400 mb-1">
                             ✓ Ingrediente selecionado
                           </div>
                           <div className="text-muted-foreground">
                             Unidade de uso: {ingredients.find(ing => ing.name === currentItem.ingredientName)?.usageUnit} • 
                             Fator de conversão: {ingredients.find(ing => ing.name === currentItem.ingredientName)?.conversionFactor}
                           </div>
                         </div>
                       </div>
                     )}
                  </div>

                  {invoiceItems.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Itens da Nota Fiscal</h3>
                      <div className="border rounded-lg">
                        <div className="grid grid-cols-7 gap-4 p-3 bg-muted font-medium text-sm">
                          <div>Ingrediente</div>
                          <div>Quantidade</div>
                          <div>Unidade</div>
                          <div>Preço Unit.</div>
                          <div>Total</div>
                          <div>Status</div>
                          <div>Ações</div>
                        </div>
                        {invoiceItems.map((item, index) => (
                          <div key={index} className="grid grid-cols-7 gap-4 p-3 border-t items-center">
                            <div className="font-medium">{item.ingredientName}</div>
                            <div>{item.quantity}</div>
                            <div>{item.purchaseUnit}</div>
                            <div>R$ {item.unitPrice.toFixed(2)}</div>
                            <div className="font-medium">R$ {item.totalPrice.toFixed(2)}</div>
                             <div>
                               <Badge variant="outline" className="text-xs">Cadastrado</Badge>
                             </div>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItemFromInvoice(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-7 gap-4 p-3 border-t bg-muted">
                          <div className="col-span-5 font-medium">Total da Nota Fiscal:</div>
                          <div className="font-bold text-lg">R$ {invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}</div>
                          <div></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Informações de Pagamento
                    </h3>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="createPayable"
                        checked={paymentData.createPayable}
                        onCheckedChange={(checked) => setPaymentData(prev => ({ ...prev, createPayable: checked as boolean }))}
                      />
                      <Label htmlFor="createPayable" className="text-sm font-medium">
                        Criar conta a pagar automaticamente
                      </Label>
                    </div>

                    {paymentData.createPayable && (
                      <div className="grid grid-cols-3 gap-3 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                          <Select
                            value={paymentData.paymentMethod}
                            onValueChange={(value) => setPaymentData(prev => ({ ...prev, paymentMethod: value }))}
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
                              <SelectItem value="Boleto Bancário">Boleto Bancário</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                              <SelectItem value="Prazo">A Prazo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="responsiblePerson">Responsável (Opcional)</Label>
                          <Input
                            id="responsiblePerson"
                            value={paymentData.responsiblePerson}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                            placeholder="Nome do responsável"
                          />
                        </div>
                        <div>
                          <Label htmlFor="paymentDate">Data de Vencimento</Label>
                          <Input
                            id="paymentDate"
                            type="date"
                            value={paymentData.paymentDate}
                            onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {paymentData.paymentDate <= new Date().toISOString().split('T')[0] 
                              ? '✅ Será criada como PAGA (vencimento hoje ou anterior)'
                              : '⏳ Será criada como PENDENTE (vencimento futuro)'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Observações sobre a compra (opcional)"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                     <Button variant="outline" onClick={() => {
                       setShowForm(false);
                       setEditingInvoice(null);
                       setFormData({
                         invoiceNumber: '',
                         supplierId: '',
                         supplierName: '',
                         invoiceDate: new Date().toISOString().split('T')[0],
                          dueDate: '',
                          totalAmount: 0,
                          notes: ''
                        });
                        setPaymentData({
                          paymentMethod: 'Dinheiro',
                          responsiblePerson: '',
                          paymentDate: new Date().toISOString().split('T')[0],
                          createPayable: true
                        });
                        setInvoiceItems([]);
                        setCurrentItem({ ingredientName: '', purchaseUnit: '', quantity: 0, unitPrice: 0 });
                      }} className="flex-1">
                       Cancelar
                     </Button>
                     <Button onClick={handleSubmit} disabled={loading || invoiceItems.length === 0} className="flex-1">
                      {loading ? 'Salvando...' : editingInvoice ? `Atualizar Nota Fiscal (${invoiceItems.length} itens)` : `Criar Nota Fiscal (${invoiceItems.length} itens)`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">Nota #{invoice.invoiceNumber}</h3>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      {invoice.stockPosted && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Lançada no Estoque
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
                     {!invoice.stockPosted ? (
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
                     ) : (
                       !invoiceHasPayable(invoice) && (
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
                       )
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
    </div>
  );
}
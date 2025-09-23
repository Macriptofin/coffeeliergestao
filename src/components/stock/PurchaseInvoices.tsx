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
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Plus, ShoppingCart, X, Package, Shield } from "lucide-react";
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
  isNewIngredient?: boolean;
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
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    supplierId: '',
    supplierName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    totalAmount: 0,
    notes: ''
  });
  const [supplierData, setSupplierData] = useState({
    companyName: '',
    cnpjCpf: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [showSupplierForm, setShowSupplierForm] = useState(false);
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
        .from('ingredients')
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
      setShowSupplierForm(false);
    } else {
      setFormData(prev => ({ 
        ...prev, 
        supplierId: '',
        supplierName: value 
      }));
      setSupplierData(prev => ({ ...prev, companyName: value }));
      setShowSupplierForm(value.length > 0);
    }
  };

  const createSupplier = async () => {
    if (!supplierData.companyName) {
      toast.error('Nome da empresa é obrigatório');
      return null;
    }

    try {
      // Verificar se o fornecedor já existe antes de tentar criar
      const { data: existingSupplier, error: checkError } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('company_name', supplierData.companyName)
        .eq('status', 'Ativo')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingSupplier) {
        // Fornecedor já existe, retornar o ID existente
        const existingSupplierFormatted = {
          id: existingSupplier.id,
          companyName: existingSupplier.company_name
        };
        
        // Atualizar lista local se não estiver presente
        setSuppliers(prev => {
          const exists = prev.some(s => s.id === existingSupplier.id);
          return exists ? prev : [...prev, existingSupplierFormatted];
        });
        
        toast.success(`Fornecedor "${supplierData.companyName}" encontrado no sistema`);
        return existingSupplier.id;
      }

      // Fornecedor não existe, criar novo
      const { data: newSupplier, error } = await supabase
        .from('suppliers')
        .insert({
          company_name: supplierData.companyName,
          cnpj_cpf: supplierData.cnpjCpf || null,
          contact_name: supplierData.contactName || null,
          email: supplierData.email || null,
          phone: supplierData.phone || null,
          address: supplierData.address || null,
          city: supplierData.city || null,
          state: supplierData.state || null,
          zip_code: supplierData.zipCode || null,
          code: `FORN${Date.now()}`,
          status: 'Ativo'
        })
        .select()
        .single();

      if (error) throw error;

      const newSupplierFormatted = {
        id: newSupplier.id,
        companyName: newSupplier.company_name
      };
      setSuppliers(prev => [...prev, newSupplierFormatted]);
      
      toast.success(`Fornecedor "${supplierData.companyName}" cadastrado com sucesso`);
      return newSupplier.id;
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      toast.error('Erro ao criar fornecedor');
      return null;
    }
  };

  const addItemToInvoice = async () => {
    if (!currentItem.ingredientName || !currentItem.purchaseUnit || !currentItem.quantity || !currentItem.unitPrice) {
      toast.error('Preencha todos os campos do item');
      return;
    }

    let selectedIngredient = ingredients.find(ing => ing.name === currentItem.ingredientName);
    let isNewIngredient = false;

    if (!selectedIngredient) {
      try {
        const { data: newIngredient, error } = await supabase
          .from('ingredients')
          .insert({
            name: currentItem.ingredientName,
            purchase_unit: currentItem.purchaseUnit,
            usage_unit: currentItem.purchaseUnit,
            conversion_factor: 1,
            price_per_purchase_unit: currentItem.unitPrice
          })
          .select()
          .single();

        if (error) throw error;

        selectedIngredient = {
          id: newIngredient.id,
          name: newIngredient.name,
          purchaseUnit: newIngredient.purchase_unit,
          usageUnit: newIngredient.usage_unit,
          conversionFactor: parseFloat(newIngredient.conversion_factor?.toString() || '1')
        };

        setIngredients(prev => [...prev, selectedIngredient!]);
        isNewIngredient = true;
        toast.success(`Ingrediente "${currentItem.ingredientName}" cadastrado com sucesso`);
      } catch (error) {
        console.error('Erro ao criar ingrediente:', error);
        toast.error('Erro ao criar novo ingrediente');
        return;
      }
    }

    const totalPrice = currentItem.quantity * currentItem.unitPrice;
    const newItem: InvoiceItem = {
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      quantity: currentItem.quantity,
      purchaseUnit: currentItem.purchaseUnit,
      unitPrice: currentItem.unitPrice,
      totalPrice,
      isNewIngredient
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
    if (!formData.invoiceNumber || (!formData.supplierId && !formData.supplierName) || invoiceItems.length === 0) {
      toast.error('Preencha os campos obrigatórios e adicione pelo menos um item');
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe uma nota fiscal com o mesmo número
      const { data: existingInvoice, error: checkInvoiceError } = await supabase
        .from('purchase_invoices')
        .select('id, invoice_number')
        .eq('invoice_number', formData.invoiceNumber)
        .single();

      if (checkInvoiceError && checkInvoiceError.code !== 'PGRST116') {
        throw checkInvoiceError;
      }

      if (existingInvoice) {
        toast.error(`Nota fiscal ${formData.invoiceNumber} já foi cadastrada no sistema`);
        setLoading(false);
        return;
      }

      let supplierId = formData.supplierId;

      // Se não tem supplierId mas tem supplierName, verificar se precisa criar ou se já existe
      if (!supplierId && formData.supplierName) {
        // Recarregar fornecedores para garantir dados atualizados
        await loadSuppliers();
        
        // Verificar novamente se o fornecedor existe após recarregar
        const existingSupplier = suppliers.find(s => s.companyName === formData.supplierName);
        
        if (existingSupplier) {
          supplierId = existingSupplier.id;
          setFormData(prev => ({ ...prev, supplierId: existingSupplier.id }));
        } else {
          supplierId = await createSupplier();
          if (!supplierId) {
            setLoading(false);
            return;
          }
        }
      }

      console.log('Criando nota fiscal com supplier_id:', supplierId);

      const { data: invoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: formData.invoiceNumber,
          supplier_id: supplierId,
          invoice_date: formData.invoiceDate,
          due_date: formData.dueDate || null,
          total_amount: formData.totalAmount,
          notes: formData.notes || null
        })
        .select()
        .single();

      if (invoiceError) {
        console.error('Erro ao criar nota fiscal:', invoiceError);
        throw invoiceError;
      }

      console.log('Nota fiscal criada:', invoice);

      // Preparar dados dos itens da nota fiscal
      const invoiceItemsData = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice
      }));

      console.log('Inserindo itens da nota fiscal:', invoiceItemsData);

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) {
        console.error('Erro ao inserir itens da nota fiscal:', itemsError);
        throw itemsError;
      }

      console.log('Itens da nota fiscal inseridos com sucesso');

      // Processar movimentações de estoque para cada item
      for (const item of invoiceItems) {
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
        
        if (!ingredient) {
          console.error('Ingrediente não encontrado:', item.ingredientId);
          continue;
        }

        console.log(`Processando item: ${item.ingredientName}`);
        console.log(`Quantidade comprada: ${item.quantity} ${item.purchaseUnit}`);
        console.log(`Fator de conversão: ${ingredient.conversionFactor}`);
        
        // Calcular quantidade em unidade de uso
        const conversionFactor = ingredient.conversionFactor || 1;
        const usageQuantity = item.quantity * conversionFactor;
        const usageUnitPrice = item.unitPrice / conversionFactor;
        
        console.log(`Quantidade para estoque: ${usageQuantity} ${ingredient.usageUnit}`);
        console.log(`Preço unitário para estoque: R$ ${usageUnitPrice.toFixed(4)}`);
        
        // Criar movimentação de estoque
        const { data: stockMovement, error: stockError } = await supabase
          .from('stock_movements')
          .insert({
            ingredient_id: item.ingredientId,
            movement_type: 'Entrada',
            quantity: usageQuantity,
            unit_price: usageUnitPrice,
            reference_type: 'purchase_invoice',
            reference_id: invoice.id,
            notes: `Nota fiscal ${formData.invoiceNumber} - Compra: ${item.quantity} ${item.purchaseUnit} = ${usageQuantity} ${ingredient.usageUnit}`
          })
          .select()
          .single();

        if (stockError) {
          console.error('Erro ao criar movimentação de estoque:', stockError);
          throw stockError;
        }

        console.log('Movimentação de estoque criada:', stockMovement);

        // Atualizar preço médio ponderado
        console.log('Chamando RPC calculate_weighted_average_price');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('calculate_weighted_average_price', {
          p_ingredient_id: item.ingredientId,
          p_new_quantity: usageQuantity,
          p_new_price: usageUnitPrice
        });

        if (rpcError) {
          console.error('Erro no RPC calculate_weighted_average_price:', rpcError);
          throw rpcError;
        }

        console.log('RPC executado com sucesso, novo preço médio:', rpcResult);
      }

      toast.success('Nota fiscal criada e estoque atualizado com sucesso');
      setShowForm(false);
      setFormData({
        invoiceNumber: '',
        supplierId: '',
        supplierName: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        totalAmount: 0,
        notes: ''
      });
      setSupplierData({
        companyName: '',
        cnpjCpf: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: ''
      });
      setShowSupplierForm(false);
      setInvoiceItems([]);
      setCurrentItem({ ingredientName: '', purchaseUnit: '', quantity: 0, unitPrice: 0 });
      onRefresh();
    } catch (error) {
      console.error('Erro ao criar nota fiscal:', error);
      toast.error(`Erro ao criar nota fiscal: ${error.message || 'Erro desconhecido'}`);
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
                  <DialogTitle>Nova Nota Fiscal</DialogTitle>
                  <DialogDescription>
                    Cadastre uma nova nota fiscal de compra para atualizar o estoque
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
                        <AutocompleteInput
                          id="supplier"
                          value={formData.supplierName}
                          onChange={handleSupplierChange}
                          suggestions={suppliers.map(supplier => supplier.companyName)}
                          placeholder="Digite o nome do fornecedor"
                        />
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

                  {showSupplierForm && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-medium">Cadastro de Novo Fornecedor</h3>
                          <Badge variant="secondary" className="text-xs">Será criado automaticamente</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="companyName">Nome da Empresa *</Label>
                            <Input
                              id="companyName"
                              value={supplierData.companyName}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, companyName: e.target.value }))}
                              placeholder="Razão Social"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cnpjCpf">CNPJ/CPF</Label>
                            <Input
                              id="cnpjCpf"
                              value={supplierData.cnpjCpf}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, cnpjCpf: e.target.value }))}
                              placeholder="00.000.000/0000-00"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="contactName">Nome do Contato</Label>
                            <Input
                              id="contactName"
                              value={supplierData.contactName}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, contactName: e.target.value }))}
                              placeholder="Nome do responsável"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                              id="email"
                              type="email"
                              value={supplierData.email}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="contato@fornecedor.com"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                              id="phone"
                              value={supplierData.phone}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="(11) 99999-9999"
                            />
                          </div>
                          <div>
                            <Label htmlFor="city">Cidade</Label>
                            <Input
                              id="city"
                              value={supplierData.city}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, city: e.target.value }))}
                              placeholder="Cidade"
                            />
                          </div>
                          <div>
                            <Label htmlFor="state">Estado</Label>
                            <Input
                              id="state"
                              value={supplierData.state}
                              onChange={(e) => setSupplierData(prev => ({ ...prev, state: e.target.value }))}
                              placeholder="SP"
                              maxLength={2}
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="address">Endereço Completo</Label>
                          <Input
                            id="address"
                            value={supplierData.address}
                            onChange={(e) => setSupplierData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Rua, número, bairro, CEP"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {formData.supplierName && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        {formData.supplierId ? (
                          <div className="font-medium text-green-700 dark:text-green-400">
                            ✓ Fornecedor encontrado no cadastro
                          </div>
                        ) : (
                          <div className="font-medium text-amber-700 dark:text-amber-400">
                            ⚠ Novo fornecedor será cadastrado automaticamente
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Adicionar Itens</h3>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <Label htmlFor="ingredientName">Ingrediente *</Label>
                        <AutocompleteInput
                          id="ingredientName"
                          value={currentItem.ingredientName}
                          onChange={(value) => setCurrentItem(prev => ({ ...prev, ingredientName: value }))}
                          suggestions={ingredients.map(ing => ing.name)}
                          placeholder="Digite o nome do ingrediente"
                        />
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
                          step="0.01"
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
                          step="0.01"
                          value={currentItem.unitPrice || ''}
                          onChange={(e) => setCurrentItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={addItemToInvoice} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                    
                    {currentItem.ingredientName && (
                      <div className="p-3 bg-muted rounded-lg">
                        {ingredients.find(ing => ing.name === currentItem.ingredientName) ? (
                          <div className="text-sm">
                            <div className="font-medium text-green-700 dark:text-green-400 mb-1">
                              ✓ Ingrediente encontrado no cadastro
                            </div>
                            <div className="text-muted-foreground">
                              Unidade de uso: {ingredients.find(ing => ing.name === currentItem.ingredientName)?.usageUnit} • 
                              Fator de conversão: {ingredients.find(ing => ing.name === currentItem.ingredientName)?.conversionFactor}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                              ⚠ Novo ingrediente será cadastrado
                            </div>
                            <div className="text-muted-foreground">
                              Este ingrediente será criado automaticamente no sistema
                            </div>
                          </div>
                        )}
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
                              {item.isNewIngredient ? (
                                <Badge variant="secondary" className="text-xs">Novo</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Cadastrado</Badge>
                              )}
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
                    <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || invoiceItems.length === 0} className="flex-1">
                      {loading ? 'Salvando...' : `Criar Nota Fiscal (${invoiceItems.length} itens)`}
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
                          {new Date(invoice.invoiceDate).toLocaleDateString('pt-BR')}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
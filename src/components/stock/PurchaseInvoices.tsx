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
import { FileText, Plus, ShoppingCart, X, Package } from "lucide-react";
import type { PurchaseInvoice } from "@/pages/Stock";

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    supplierId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    totalAmount: 0,
    notes: ''
  });
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

  const addItemToInvoice = async () => {
    if (!currentItem.ingredientName || !currentItem.purchaseUnit || !currentItem.quantity || !currentItem.unitPrice) {
      toast.error('Preencha todos os campos do item');
      return;
    }

    let selectedIngredient = ingredients.find(ing => ing.name === currentItem.ingredientName);
    let isNewIngredient = false;

    // Se o ingrediente não existe, criar um novo
    if (!selectedIngredient) {
      try {
        const { data: newIngredient, error } = await supabase
          .from('ingredients')
          .insert({
            name: currentItem.ingredientName,
            purchase_unit: currentItem.purchaseUnit,
            usage_unit: currentItem.purchaseUnit, // Por padrão, usar a mesma unidade
            conversion_factor: 1, // Por padrão, fator 1
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

        // Atualizar lista de ingredientes
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
    
    // Atualizar total automaticamente
    const newTotal = [...invoiceItems, newItem].reduce((sum, item) => sum + item.totalPrice, 0);
    setFormData(prev => ({ ...prev, totalAmount: newTotal }));
  };

  const removeItemFromInvoice = (index: number) => {
    const newItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(newItems);
    
    // Atualizar total
    const newTotal = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setFormData(prev => ({ ...prev, totalAmount: newTotal }));
  };

  const handleSubmit = async () => {
    if (!formData.invoiceNumber || !formData.supplierId || invoiceItems.length === 0) {
      toast.error('Preencha os campos obrigatórios e adicione pelo menos um item');
      return;
    }

    setLoading(true);
    try {
      // Criar a nota fiscal
      const { data: invoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .insert({
          invoice_number: formData.invoiceNumber,
          supplier_id: formData.supplierId,
          invoice_date: formData.invoiceDate,
          due_date: formData.dueDate || null,
          total_amount: formData.totalAmount,
          notes: formData.notes || null
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Criar itens da nota fiscal
      const invoiceItemsData = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        supplier_product_id: item.ingredientId, // Usando ingredientId como referência
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);

      if (itemsError) throw itemsError;

      // Criar movimentações de estoque para cada item
      for (const item of invoiceItems) {
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
        
        // Calcular quantidade convertida para unidade de uso
        const conversionFactor = ingredient?.conversionFactor || 1;
        const usageQuantity = item.quantity * conversionFactor;
        
        // Criar movimentação de entrada (sempre em unidade de uso)
        await supabase.from('stock_movements').insert({
          ingredient_id: item.ingredientId,
          movement_type: 'Entrada',
          quantity: usageQuantity, // Quantidade convertida para unidade de uso
          unit_price: item.unitPrice / conversionFactor, // Preço unitário ajustado para unidade de uso
          reference_type: 'purchase_invoice',
          reference_id: invoice.id,
          notes: `Nota fiscal ${formData.invoiceNumber} - Compra: ${item.quantity} ${item.purchaseUnit}`
        });

        // Atualizar estoque usando a função de preço médio ponderado
        await supabase.rpc('calculate_weighted_average_price', {
          p_ingredient_id: item.ingredientId,
          p_new_quantity: usageQuantity, // Quantidade em unidade de uso
          p_new_price: item.unitPrice / conversionFactor // Preço por unidade de uso
        });
      }

      toast.success('Nota fiscal criada e estoque atualizado com sucesso');
      setShowForm(false);
      setFormData({
        invoiceNumber: '',
        supplierId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        totalAmount: 0,
        notes: ''
      });
      setInvoiceItems([]);
      setCurrentItem({ ingredientName: '', purchaseUnit: '', quantity: 0, unitPrice: 0 });
      onRefresh();
    } catch (error) {
      console.error('Erro ao criar nota fiscal:', error);
      toast.error('Erro ao criar nota fiscal');
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
                  {/* Dados da Nota Fiscal */}
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
                        <Select value={formData.supplierId} onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o fornecedor" />
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

                  <Separator />

                  {/* Adição de Itens */}
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
                    
                    {/* Mostrar informações do ingrediente selecionado */}
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

                  {/* Lista de Itens Adicionados */}
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

                  {/* Observações */}
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

                  {/* Botões */}
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
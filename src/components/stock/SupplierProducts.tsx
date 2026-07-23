import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Link, Edit } from "lucide-react";

interface SupplierProduct {
  id: string;
  supplier: {
    id: string;
    companyName: string;
  };
  ingredient: {
    id: string;
    name: string;
    usageUnit: string;
  };
  supplierProductName: string;
  supplierProductCode?: string;
  supplierUnit: string;
  conversionFactor: number;
  lastPrice?: number;
  isActive: boolean;
}

interface Supplier {
  id: string;
  companyName: string;
}

interface Ingredient {
  id: string;
  name: string;
  usageUnit: string;
}

interface SupplierProductsProps {
  onRefresh: () => void;
}

async function fetchSupplierProducts(): Promise<SupplierProduct[]> {
  const { data, error } = await supabase
    .from('supplier_products')
    .select(`
      *,
      suppliers (
        id,
        company_name
      ),
      materials:material_id (
        id,
        name,
        usage_unit
      )
    `)
    .eq('is_active', true)
    .order('supplier_product_name');

  if (error) throw error;

  return data.map(item => ({
    id: item.id,
    supplier: {
      id: item.suppliers.id,
      companyName: item.suppliers.company_name
    },
    ingredient: {
      id: item.materials.id,
      name: item.materials.name,
      usageUnit: item.materials.usage_unit
    },
    supplierProductName: item.supplier_product_name,
    supplierProductCode: item.supplier_product_code,
    supplierUnit: item.supplier_unit,
    conversionFactor: parseFloat(item.conversion_factor?.toString() || '1'),
    lastPrice: item.last_price ? parseFloat(item.last_price?.toString() || '0') : undefined,
    isActive: item.is_active
  }));
}

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

async function fetchAllIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, usage_unit')
    .order('name');

  if (error) throw error;

  return data.map(item => ({
    id: item.id,
    name: item.name,
    usageUnit: item.usage_unit
  }));
}

const EMPTY_SUPPLIER_PRODUCTS: SupplierProduct[] = [];
const EMPTY_SUPPLIERS: Supplier[] = [];
const EMPTY_INGREDIENTS: Ingredient[] = [];
const SUPPLIER_PRODUCTS_QUERY_KEY = ['supplier-products'] as const;

export function SupplierProducts({ onRefresh }: SupplierProductsProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    ingredientId: '',
    supplierProductName: '',
    supplierProductCode: '',
    supplierUnit: '',
    conversionFactor: 1,
    lastPrice: 0
  });

  const { data: supplierProducts = EMPTY_SUPPLIER_PRODUCTS, isPending: loading, isError } = useQuery({
    queryKey: SUPPLIER_PRODUCTS_QUERY_KEY,
    queryFn: fetchSupplierProducts,
  });
  const { data: suppliers = EMPTY_SUPPLIERS } = useQuery({
    queryKey: ['active-suppliers-list'],
    queryFn: fetchActiveSuppliersList,
  });
  const { data: ingredients = EMPTY_INGREDIENTS } = useQuery({
    queryKey: ['all-ingredients'],
    queryFn: fetchAllIngredients,
  });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar dados');
  }, [isError]);

  const reload = () => queryClient.invalidateQueries({ queryKey: SUPPLIER_PRODUCTS_QUERY_KEY });

  const handleSubmit = async () => {
    if (!formData.supplierId || !formData.ingredientId || !formData.supplierProductName) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (editingProduct) {
        await supabase
          .from('supplier_products')
          .update({
            supplier_product_name: formData.supplierProductName,
            supplier_product_code: formData.supplierProductCode || null,
            supplier_unit: formData.supplierUnit,
            conversion_factor: formData.conversionFactor,
            last_price: formData.lastPrice || null
          })
          .eq('id', editingProduct.id);
      } else {
        await supabase
          .from('supplier_products')
          .insert({
            supplier_id: formData.supplierId,
            material_id: formData.ingredientId,
            supplier_product_name: formData.supplierProductName,
            supplier_product_code: formData.supplierProductCode || null,
            supplier_unit: formData.supplierUnit,
            conversion_factor: formData.conversionFactor,
            last_price: formData.lastPrice || null
          });
      }

      toast.success(editingProduct ? 'Produto atualizado com sucesso' : 'Produto criado com sucesso');
      resetForm();
      onRefresh();
      reload();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error('Erro ao salvar produto do fornecedor');
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      ingredientId: '',
      supplierProductName: '',
      supplierProductCode: '',
      supplierUnit: '',
      conversionFactor: 1,
      lastPrice: 0
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleEdit = (product: SupplierProduct) => {
    setEditingProduct(product);
    setFormData({
      supplierId: product.supplier.id,
      ingredientId: product.ingredient.id,
      supplierProductName: product.supplierProductName,
      supplierProductCode: product.supplierProductCode || '',
      supplierUnit: product.supplierUnit,
      conversionFactor: product.conversionFactor,
      lastPrice: product.lastPrice || 0
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Produtos dos Fornecedores
              </CardTitle>
              <CardDescription>
                Mapeamento entre produtos dos fornecedores e ingredientes internos
              </CardDescription>
            </div>
            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Mapear Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Editar Produto do Fornecedor' : 'Mapear Novo Produto'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct 
                      ? 'Atualize as informações do produto do fornecedor'
                      : 'Vincule um produto do fornecedor ao ingrediente interno correspondente'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {!editingProduct && (
                    <>
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

                      <div>
                        <Label htmlFor="ingredient">Ingrediente Interno *</Label>
                        <Select value={formData.ingredientId} onValueChange={(value) => setFormData(prev => ({ ...prev, ingredientId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.map(ingredient => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.name} ({ingredient.usageUnit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="supplierProductName">Nome do Produto no Fornecedor *</Label>
                      <Input
                        id="supplierProductName"
                        value={formData.supplierProductName}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierProductName: e.target.value }))}
                        placeholder="Ex: Bisnaga da Pullman"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierProductCode">Código do Fornecedor</Label>
                      <Input
                        id="supplierProductCode"
                        value={formData.supplierProductCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierProductCode: e.target.value }))}
                        placeholder="Ex: BP001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="supplierUnit">Unidade do Fornecedor</Label>
                      <Input
                        id="supplierUnit"
                        value={formData.supplierUnit}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierUnit: e.target.value }))}
                        placeholder="Ex: Pacote, Kg, Un"
                      />
                    </div>
                    <div>
                      <Label htmlFor="conversionFactor">Fator de Conversão</Label>
                      <Input
                        id="conversionFactor"
                        type="number"
                        step="0.001"
                        value={formData.conversionFactor}
                        onChange={(e) => setFormData(prev => ({ ...prev, conversionFactor: parseFloat(e.target.value) || 1 }))}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="lastPrice">Último Preço</Label>
                    <Input
                      id="lastPrice"
                      type="number"
                      step="0.01"
                      value={formData.lastPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastPrice: parseFloat(e.target.value) || 0 }))}
                      placeholder="0,00"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={resetForm} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} className="flex-1">
                      {editingProduct ? 'Atualizar' : 'Mapear Produto'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {supplierProducts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum produto mapeado</p>
              <p className="text-sm text-muted-foreground">
                Mapeie produtos dos fornecedores para facilitar o lançamento de notas fiscais
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {supplierProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{product.supplierProductName}</h3>
                      {product.supplierProductCode && (
                        <Badge variant="outline">
                          {product.supplierProductCode}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="block font-medium text-foreground">
                          {product.supplier.companyName}
                        </span>
                        <span>Fornecedor</span>
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">
                          {product.ingredient.name}
                        </span>
                        <span>Ingrediente Interno</span>
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">
                          {product.supplierUnit} → {product.ingredient.usageUnit}
                        </span>
                        <span>Conversão (x{product.conversionFactor})</span>
                      </div>
                      <div>
                        <span className="block font-medium text-foreground">
                          {product.lastPrice ? `R$ ${product.lastPrice.toFixed(2)}` : 'Sem preço'}
                        </span>
                        <span>Último Preço</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="ml-4"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
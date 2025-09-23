import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Minus, Save, ArrowLeft } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit_weight: number;
  selling_price: number;
}

interface ProposalItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_weight: number;
  total_price: number;
  total_weight: number;
}

interface Props {
  proposalId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const productCategories = [
  { key: 'Salgados', label: 'Salgados', color: 'bg-red-100 text-red-800' },
  { key: 'Doces', label: 'Doces', color: 'bg-pink-100 text-pink-800' },
  { key: 'Low Fat', label: 'Low Fat', color: 'bg-green-100 text-green-800' },
  { key: 'Bebidas', label: 'Bebidas', color: 'bg-blue-100 text-blue-800' }
];

export default function ProposalComposer({ proposalId, onComplete, onCancel }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, ProposalItem>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [proposalId]);

  const loadData = async () => {
    try {
      const [productsResult, proposalResult] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true }),
        supabase
          .from('proposals')
          .select('*')
          .eq('id', proposalId)
          .single()
      ]);

      if (productsResult.error) throw productsResult.error;
      if (proposalResult.error) throw proposalResult.error;

      setProducts(productsResult.data || []);
      setProposal(proposalResult.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity <= 0) {
      const newItems = { ...selectedItems };
      delete newItems[productId];
      setSelectedItems(newItems);
      return;
    }

    const item: ProposalItem = {
      product_id: productId,
      quantity,
      unit_price: product.selling_price,
      unit_weight: product.unit_weight,
      total_price: quantity * product.selling_price,
      total_weight: quantity * product.unit_weight
    };

    setSelectedItems(prev => ({
      ...prev,
      [productId]: item
    }));
  };

  const getQuantity = (productId: string) => {
    return selectedItems[productId]?.quantity || 0;
  };

  const calculateTotals = () => {
    const items = Object.values(selectedItems);
    return {
      totalWeight: items.reduce((sum, item) => sum + item.total_weight, 0),
      totalAmount: items.reduce((sum, item) => sum + item.total_price, 0),
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0)
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const items = Object.values(selectedItems);
      if (items.length === 0) {
        toast.error('Selecione pelo menos um produto');
        return;
      }

      const totals = calculateTotals();

      // Salvar itens da proposta
      const { error: itemsError } = await supabase
        .from('proposal_items')
        .insert(items.map(item => ({
          proposal_id: proposalId,
          ...item
        })));

      if (itemsError) throw itemsError;

      // Atualizar totais da proposta
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({
          total_weight: totals.totalWeight,
          total_amount: totals.totalAmount,
          status: 'Em Análise'
        })
        .eq('id', proposalId);

      if (proposalError) throw proposalError;

      toast.success('Proposta finalizada com sucesso!');
      onComplete();
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      toast.error('Erro ao salvar proposta');
    } finally {
      setSaving(false);
    }
  };

  const groupedProducts = productCategories.map(category => ({
    ...category,
    products: products.filter(p => p.category === category.key)
  }));

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Composição da Proposta</h2>
          <p className="text-muted-foreground">
            {proposal?.proposal_number} - {proposal?.event_category} para {proposal?.number_of_people} pessoas
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Resumo dos Totais */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{totals.totalItems}</div>
              <div className="text-sm text-muted-foreground">Itens Selecionados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{totals.totalWeight}g</div>
              <div className="text-sm text-muted-foreground">Peso Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">R$ {totals.totalAmount.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Valor Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Produtos por Categoria */}
      <div className="space-y-6">
        {groupedProducts.map(category => (
          <Card key={category.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={category.color}>{category.label}</Badge>
                <span className="text-sm text-muted-foreground">
                  ({category.products.length} produtos disponíveis)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {category.products.length > 0 ? (
                <div className="space-y-4">
                  {category.products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {product.code} - {product.unit_weight}g - R$ {product.selling_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(product.id, Math.max(0, getQuantity(product.id) - 1))}
                          disabled={getQuantity(product.id) === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={getQuantity(product.id)}
                          onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(product.id, getQuantity(product.id) + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {getQuantity(product.id) > 0 && (
                          <div className="ml-4 text-sm text-muted-foreground">
                            Total: {getQuantity(product.id) * product.unit_weight}g - 
                            R$ {(getQuantity(product.id) * product.selling_price).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum produto disponível nesta categoria</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving || totals.totalItems === 0}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Finalizar Proposta'}
        </Button>
      </div>
    </div>
  );
}
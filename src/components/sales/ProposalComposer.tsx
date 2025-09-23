import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Minus, Save, ArrowLeft, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  unit_weight: number;
  price_per_purchase_unit: number;
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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, ProposalItem>>({});
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [proposalId]);

  const loadData = async () => {
    try {
      const [materialsResult, proposalResult] = await Promise.all([
        supabase
          .from('materials')
          .select('*')
          .order('category', { ascending: true }),
        supabase
          .from('proposals')
          .select('*')
          .eq('id', proposalId)
          .single()
      ]);

      if (materialsResult.error) throw materialsResult.error;
      if (proposalResult.error) throw proposalResult.error;

      setMaterials(materialsResult.data || []);
      setProposal(proposalResult.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const addMaterialToCategory = (categoryKey: string, materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    // Add material to category selection
    setSelectedMaterialIds(prev => ({
      ...prev,
      [categoryKey]: [...(prev[categoryKey] || []), materialId]
    }));

    // Initialize with quantity 1
    updateQuantity(materialId, 1);
  };

  const removeMaterialFromCategory = (categoryKey: string, materialId: string) => {
    // Remove from category selection
    setSelectedMaterialIds(prev => ({
      ...prev,
      [categoryKey]: (prev[categoryKey] || []).filter(id => id !== materialId)
    }));

    // Remove from selected items
    const newItems = { ...selectedItems };
    delete newItems[materialId];
    setSelectedItems(newItems);
  };

  const updateQuantity = (materialId: string, quantity: number) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    if (quantity <= 0) {
      const newItems = { ...selectedItems };
      delete newItems[materialId];
      setSelectedItems(newItems);
      return;
    }

    const item: ProposalItem = {
      product_id: materialId, // Mantemos product_id para compatibilidade com a tabela proposal_items
      quantity,
      unit_price: material.price_per_purchase_unit,
      unit_weight: material.unit_weight || 0,
      total_price: quantity * material.price_per_purchase_unit,
      total_weight: quantity * (material.unit_weight || 0)
    };

    setSelectedItems(prev => ({
      ...prev,
      [materialId]: item
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

  const groupedMaterials = productCategories.map(category => ({
    ...category,
    materials: materials.filter(m => m.category === category.key || (!m.category && category.key === 'Salgados'))
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

      {/* Seleção de Materiais por Categoria */}
      <div className="space-y-6">
        {groupedMaterials.map(category => {
          const categorySelectedMaterials = selectedMaterialIds[category.key] || [];
          const availableMaterials = category.materials.filter(m => !categorySelectedMaterials.includes(m.id));
          
          return (
            <Card key={category.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={category.color}>{category.label}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({category.materials.length} materiais disponíveis)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Combobox para seleção de materiais */}
                {availableMaterials.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Adicionar material:</Label>
                    <Combobox
                      placeholder={`Selecione um material de ${category.label.toLowerCase()}...`}
                      searchPlaceholder={`Buscar ${category.label.toLowerCase()}...`}
                      emptyText="Nenhum material encontrado."
                      options={availableMaterials.map(material => ({
                        value: material.id,
                        label: `${material.name} - ${material.code || 'Sem código'} - ${material.unit_weight || 0}g - R$ ${material.price_per_purchase_unit.toFixed(2)}`
                      }))}
                      onSelect={(materialId) => {
                        if (materialId) {
                          addMaterialToCategory(category.key, materialId);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Lista de materiais selecionados */}
                {categorySelectedMaterials.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Materiais selecionados:</Label>
                    {categorySelectedMaterials.map(materialId => {
                      const material = materials.find(m => m.id === materialId);
                      if (!material) return null;
                      
                      return (
                        <div key={materialId} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <h4 className="font-medium">{material.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {material.code || 'Sem código'} - {material.unit_weight || 0}g - R$ {material.price_per_purchase_unit.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(material.id, Math.max(0, getQuantity(material.id) - 1))}
                              disabled={getQuantity(material.id) === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={getQuantity(material.id)}
                              onChange={(e) => updateQuantity(material.id, parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(material.id, getQuantity(material.id) + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeMaterialFromCategory(category.key, material.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            {getQuantity(material.id) > 0 && (
                              <div className="ml-2 text-sm text-muted-foreground">
                                Total: {getQuantity(material.id) * (material.unit_weight || 0)}g - 
                                R$ {(getQuantity(material.id) * material.price_per_purchase_unit).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {categorySelectedMaterials.length === 0 && availableMaterials.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum material disponível nesta categoria</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
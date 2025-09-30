import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Minus, Save, ArrowLeft, X, Factory } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  unit_weight: number;
  price_per_purchase_unit: number;
}

interface CategoryItem {
  material_id: string;
  quantity: number;
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

export default function ProposalCategoryComposer({ proposalId, onComplete, onCancel }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categoryItems, setCategoryItems] = useState<Record<string, Record<string, CategoryItem>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, [proposalId]);

  const loadData = async () => {
    try {
      const [materialsResult, proposalResult] = await Promise.all([
        supabase
          .from('materials')
          .select('*')
          .eq('is_sellable', true)
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
      
      // Load existing categories and items if any
      await loadExistingCategories();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingCategories = async () => {
    try {
      const { data: categories, error } = await supabase
        .from('proposal_categories')
        .select(`
          id,
          category_label,
          proposal_category_items (
            material_id,
            quantity
          )
        `)
        .eq('proposal_id', proposalId);

      if (error) throw error;

      const categoryMap: Record<string, Record<string, CategoryItem>> = {};
      categories?.forEach(cat => {
        categoryMap[cat.category_label] = {};
        cat.proposal_category_items?.forEach((item: any) => {
          categoryMap[cat.category_label][item.material_id] = {
            material_id: item.material_id,
            quantity: item.quantity
          };
        });
      });

      setCategoryItems(categoryMap);
    } catch (error) {
      console.error('Erro ao carregar categorias existentes:', error);
    }
  };

  const addMaterialToCategory = (categoryKey: string, materialId: string) => {
    setCategoryItems(prev => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] || {}),
        [materialId]: {
          material_id: materialId,
          quantity: 1
        }
      }
    }));
  };

  const removeMaterialFromCategory = (categoryKey: string, materialId: string) => {
    setCategoryItems(prev => {
      const newCategoryItems = { ...prev[categoryKey] };
      delete newCategoryItems[materialId];
      return {
        ...prev,
        [categoryKey]: newCategoryItems
      };
    });
  };

  const updateQuantity = (categoryKey: string, materialId: string, quantity: number) => {
    if (quantity <= 0) {
      removeMaterialFromCategory(categoryKey, materialId);
      return;
    }

    setCategoryItems(prev => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] || {}),
        [materialId]: {
          material_id: materialId,
          quantity
        }
      }
    }));
  };

  const getQuantity = (categoryKey: string, materialId: string) => {
    return categoryItems[categoryKey]?.[materialId]?.quantity || 0;
  };

  const calculateTotals = () => {
    let totalItems = 0;
    let totalAmount = 0;
    let totalWeight = 0;

    Object.values(categoryItems).forEach(category => {
      Object.values(category).forEach(item => {
        const material = materials.find(m => m.id === item.material_id);
        if (material) {
          totalItems += item.quantity;
          totalAmount += item.quantity * material.price_per_purchase_unit;
          totalWeight += item.quantity * (material.unit_weight || 0);
        }
      });
    });

    return { totalItems, totalAmount, totalWeight };
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const totals = calculateTotals();

      if (totals.totalItems === 0) {
        toast.error('Selecione pelo menos um material');
        return;
      }

      // Delete existing categories and items
      const { error: deleteError } = await supabase
        .from('proposal_categories')
        .delete()
        .eq('proposal_id', proposalId);

      if (deleteError) throw deleteError;

      // Insert categories and items
      for (const [categoryLabel, items] of Object.entries(categoryItems)) {
        if (Object.keys(items).length === 0) continue;

        // Insert category
        const { data: category, error: categoryError } = await supabase
          .from('proposal_categories')
          .insert({
            proposal_id: proposalId,
            category_label: categoryLabel,
            position: productCategories.findIndex(c => c.key === categoryLabel) + 1
          })
          .select()
          .single();

        if (categoryError) throw categoryError;

        // Insert items
        const itemsToInsert = Object.values(items).map((item, index) => ({
          category_id: category.id,
          material_id: item.material_id,
          fixed_qty: item.quantity,
          item_kind: 'fixed'
        }));

        const { error: itemsError } = await supabase
          .from('proposal_category_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update proposal totals
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          total_weight: totals.totalWeight,
          total_amount: totals.totalAmount,
          status: 'Enviada'
        })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      toast.success('Proposta salva com sucesso!');
      onComplete();
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      toast.error('Erro ao salvar proposta');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateProduction = async () => {
    try {
      setGenerating(true);

      // First save the proposal
      await handleSave();

      // Then generate production
      const { data, error } = await supabase.rpc('generate_production_from_proposal', {
        p_proposal_id: proposalId
      });

      if (error) throw error;

      toast.success('Produção gerada com sucesso!');
      console.log('Production generation result:', data);
      onComplete();
    } catch (error) {
      console.error('Erro ao gerar produção:', error);
      toast.error('Erro ao gerar produção');
    } finally {
      setGenerating(false);
    }
  };

  const groupedMaterials = productCategories.map(category => ({
    ...category,
    materials: materials.filter(m => m.category === category.key)
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
          const categorySelectedMaterials = Object.keys(categoryItems[category.key] || {});
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
                              onClick={() => updateQuantity(category.key, material.id, Math.max(0, getQuantity(category.key, material.id) - 1))}
                              disabled={getQuantity(category.key, material.id) === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={getQuantity(category.key, material.id)}
                              onChange={(e) => updateQuantity(category.key, material.id, parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(category.key, material.id, getQuantity(category.key, material.id) + 1)}
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
                            {getQuantity(category.key, material.id) > 0 && (
                              <div className="ml-2 text-sm text-muted-foreground">
                                Total: {getQuantity(category.key, material.id) * (material.unit_weight || 0)}g - 
                                R$ {(getQuantity(category.key, material.id) * material.price_per_purchase_unit).toFixed(2)}
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
        <Button onClick={handleSave} disabled={saving || totals.totalItems === 0} variant="secondary">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Proposta'}
        </Button>
        <Button onClick={handleGenerateProduction} disabled={generating || totals.totalItems === 0}>
          <Factory className="h-4 w-4 mr-2" />
          {generating ? 'Gerando...' : 'Gerar Produção'}
        </Button>
      </div>
    </div>
  );
}

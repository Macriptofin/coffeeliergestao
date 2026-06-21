import React, { useState, useEffect, useCallback } from 'react';
import { MEASUREMENT_UNITS } from '@/lib/units';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { NumericInput } from '@/components/ui/numeric-input';
import { Combobox } from '@/components/ui/combobox';

interface Material {
  id: string;
  name: string;
  code: string;
  usage_unit: string;
  material_type: string;
  average_price?: number;   // de stock_items
  cached_unit_cost?: number; // de recipes_bom (para intermediários)
}

interface BOMItem {
  id?: string;
  material_id: string;
  quantity: number;
  unit: string;
  waste_percent: number;
  is_packaging: boolean;
  position: number;
}

interface RecipeBOM {
  id?: string;
  finished_material_id: string;
  yield_quantity: number;
  yield_unit: string;
  waste_percent: number;
  notes?: string;
  items: BOMItem[];
  cached_total_cost?: number;
  cached_unit_cost?: number;
  cost_status?: string;
}

interface RecipeBOMFormProps {
  finishedMaterial?: Material;
  onSuccess: () => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  ingredient: 'Insumo',
  packaging: 'Embalagem',
  intermediate_product: 'Intermediário',
  raw_material: 'Mat. Prima',
};

const TYPE_COLORS: Record<string, string> = {
  ingredient: 'bg-blue-100 text-blue-700',
  packaging: 'bg-amber-100 text-amber-700',
  intermediate_product: 'bg-purple-100 text-purple-700',
  raw_material: 'bg-green-100 text-green-700',
};

const fmt = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const RecipeBOMForm: React.FC<RecipeBOMFormProps> = ({
  finishedMaterial,
  onSuccess,
  onCancel
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [productOptions, setProductOptions] = useState<{id: string; name: string; code: string; usage_unit: string; material_type: string}[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [bomData, setBomData] = useState<RecipeBOM>({
    finished_material_id: finishedMaterial?.id || '',
    yield_quantity: 1,
    yield_unit: finishedMaterial?.usage_unit || 'un',
    waste_percent: 0,
    notes: '',
    items: []
  });

  useEffect(() => {
    loadMaterials();
    if (finishedMaterial?.id) {
      loadExistingBOM();
    }
    if (!finishedMaterial) {
      loadProductOptions();
    }
  }, [finishedMaterial]);

  const loadProductOptions = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, material_type')
        .in('material_type', ['intermediate_product', 'finished_product'])
        .eq('is_archived', false)
        .order('name');
      if (error) throw error;
      setProductOptions(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleProductSelect = async (productId: string) => {
    const product = productOptions.find(p => p.id === productId);
    if (!product) return;
    // Reset form for the new product
    setBomData({
      finished_material_id: productId,
      yield_quantity: 1,
      yield_unit: product.usage_unit || 'un',
      waste_percent: 0,
      notes: '',
      items: [],
    });
    // Load existing BOM if it exists for this product
    try {
      const { data } = await supabase
        .from('recipes_bom')
        .select('*, recipe_bom_items (*)')
        .eq('finished_material_id', productId)
        .maybeSingle();
      if (data) {
        setBomData({
          id: data.id,
          finished_material_id: data.finished_material_id,
          yield_quantity: data.yield_quantity,
          yield_unit: data.yield_unit,
          waste_percent: data.waste_percent,
          notes: data.notes || '',
          cached_total_cost: data.cached_total_cost,
          cached_unit_cost: data.cached_unit_cost,
          cost_status: data.cost_status,
          items: (data.recipe_bom_items || []).map((item: any) => ({
            id: item.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit,
            waste_percent: item.waste_percent,
            is_packaging: item.is_packaging,
            position: item.position
          }))
        });
      }
    } catch (error) {
      console.error('Erro ao carregar BOM existente:', error);
    }
  };

  const loadMaterials = async () => {
    try {
      // Buscar materiais que podem ser componentes de uma ficha técnica:
      // insumos, embalagens e produtos intermediários (que já têm sua própria ficha)
      const { data: mats, error } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, material_type')
        .in('material_type', ['ingredient', 'packaging', 'intermediate_product', 'raw_material'])
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;

      // Buscar preços de custo: average_price de stock_items (insumos)
      // e cached_unit_cost de recipes_bom (intermediários)
      const ids = (mats || []).map(m => m.id);
      if (ids.length === 0) { setMaterials([]); return; }

      const [{ data: stocks }, { data: boms }] = await Promise.all([
        supabase
          .from('stock_items')
          .select('material_id, average_price')
          .in('material_id', ids),
        supabase
          .from('recipes_bom')
          .select('finished_material_id, cached_unit_cost')
          .in('finished_material_id', ids)
          .eq('is_archived', false)
      ]);

      const stockMap = Object.fromEntries(
        (stocks || []).map(s => [s.material_id, s.average_price])
      );
      const bomCostMap = Object.fromEntries(
        (boms || []).map(b => [b.finished_material_id, b.cached_unit_cost])
      );

      const enriched: Material[] = (mats || []).map(m => ({
        ...m,
        average_price: stockMap[m.id] ?? undefined,
        cached_unit_cost: bomCostMap[m.id] ?? undefined,
      }));

      setMaterials(enriched);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    }
  };

  const loadExistingBOM = async () => {
    if (!finishedMaterial?.id) return;
    try {
      const { data, error } = await supabase
        .from('recipes_bom')
        .select('*, recipe_bom_items (*)')
        .eq('finished_material_id', finishedMaterial.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setBomData({
          id: data.id,
          finished_material_id: data.finished_material_id,
          yield_quantity: data.yield_quantity,
          yield_unit: data.yield_unit,
          waste_percent: data.waste_percent,
          notes: data.notes || '',
          cached_total_cost: data.cached_total_cost,
          cached_unit_cost: data.cached_unit_cost,
          cost_status: data.cost_status,
          items: (data.recipe_bom_items || []).map((item: any) => ({
            id: item.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit,
            waste_percent: item.waste_percent,
            is_packaging: item.is_packaging,
            position: item.position
          }))
        });
      }
    } catch (error) {
      console.error('Erro ao carregar BOM existente:', error);
    }
  };

  // Custo unitário de um material: average_price (insumos) ou cached_unit_cost (intermediários)
  const getMaterialUnitCost = useCallback((materialId: string): number | undefined => {
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return undefined;
    if (mat.material_type === 'intermediate_product') {
      return mat.cached_unit_cost ?? mat.average_price;
    }
    return mat.average_price;
  }, [materials]);

  // Custo estimado de um item = quantidade * custo_unitário
  const getItemCost = (item: BOMItem): number | undefined => {
    const uc = getMaterialUnitCost(item.material_id);
    if (uc == null || uc === 0) return undefined;
    const qty = item.quantity * (1 + (item.waste_percent || 0) / 100);
    return qty * uc;
  };

  // CMV total estimado (soma dos itens com custo conhecido)
  const estimatedTotalCost = bomData.items.reduce((sum, item) => {
    const c = getItemCost(item);
    return sum + (c ?? 0);
  }, 0);

  const estimatedUnitCost =
    bomData.yield_quantity > 0 ? estimatedTotalCost / bomData.yield_quantity : 0;

  const addBOMItem = () => {
    setBomData(prev => ({
      ...prev,
      items: [...prev.items, {
        material_id: '',
        quantity: 0,
        unit: 'g',
        waste_percent: 0,
        is_packaging: false,
        position: prev.items.length + 1
      }]
    }));
  };

  const updateBOMItem = (index: number, field: keyof BOMItem, value: any) => {
    setBomData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        // Preencher unidade automaticamente ao selecionar material
        if (field === 'material_id') {
          const mat = materials.find(m => m.id === value);
          if (mat) updated.unit = mat.usage_unit || 'g';
        }
        return updated;
      })
    }));
  };

  const removeBOMItem = (index: number) => {
    setBomData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bomData.finished_material_id) {
      toast.error('Selecione o produto ao qual a ficha técnica pertence');
      return;
    }
    if (bomData.items.length === 0) {
      toast.error('Informe pelo menos um componente na receita');
      return;
    }

    const hasEmpty = bomData.items.some(i => !i.material_id || i.quantity <= 0);
    if (hasEmpty) {
      toast.error('Todos os itens precisam ter material e quantidade');
      return;
    }

    setLoading(true);
    try {
      let bomId = bomData.id;

      if (bomId) {
        const { error } = await supabase
          .from('recipes_bom')
          .update({
            yield_quantity: bomData.yield_quantity,
            yield_unit: bomData.yield_unit,
            waste_percent: bomData.waste_percent,
            notes: bomData.notes
          })
          .eq('id', bomId);
        if (error) throw error;

        await supabase.from('recipe_bom_items').delete().eq('recipe_id', bomId);
      } else {
        const { data, error } = await supabase
          .from('recipes_bom')
          .insert({
            finished_material_id: bomData.finished_material_id,
            yield_quantity: bomData.yield_quantity,
            yield_unit: bomData.yield_unit,
            waste_percent: bomData.waste_percent,
            notes: bomData.notes
          })
          .select()
          .single();
        if (error) throw error;
        bomId = data.id;
      }

      const { error: itemsError } = await supabase
        .from('recipe_bom_items')
        .insert(bomData.items.map((item, idx) => ({
          recipe_id: bomId,
          material_id: item.material_id,
          quantity: item.quantity,
          // Unidade sempre a do cadastro do material (usage_unit) — fonte da verdade.
          unit: materials.find(m => m.id === item.material_id)?.usage_unit || item.unit,
          waste_percent: item.waste_percent,
          is_packaging: item.is_packaging,
          position: idx + 1
        })));
      if (itemsError) throw itemsError;

      // Disparar recálculo de custo imediatamente após salvar
      try {
        for (const item of bomData.items) {
          await supabase.rpc('trigger_refresh_bom_costs_on_material_price_change' as any, {
            p_material_id: item.material_id
          });
        }
      } catch (_) {
        // Não crítico — o trigger automático recalcula na próxima compra
      }

      toast.success('Ficha técnica salva com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar BOM:', error);
      if (error?.message?.includes('Ciclo')) {
        toast.error('Referência circular detectada: um produto não pode conter a si mesmo na receita');
      } else {
        toast.error('Erro ao salvar ficha técnica');
      }
    } finally {
      setLoading(false);
    }
  };

  // Recalcular custos manualmente (botão Atualizar CMV)
  const handleRecalculate = async () => {
    if (!bomData.finished_material_id) return;
    setRecalculating(true);
    try {
      for (const item of bomData.items) {
        if (item.material_id) {
          await supabase.rpc('trigger_refresh_bom_costs_on_material_price_change' as any, {
            p_material_id: item.material_id
          });
        }
      }
      await loadExistingBOM();
      await loadMaterials();
      toast.success('CMV recalculado com base nos preços médios atuais');
    } catch {
      toast.error('Erro ao recalcular CMV');
    } finally {
      setRecalculating(false);
    }
  };

  const yieldUnits = MEASUREMENT_UNITS;
  const usageUnits = MEASUREMENT_UNITS;

  const costStatusColor = {
    complete: 'text-emerald-600',
    partial: 'text-amber-600',
    incomplete: 'text-red-600',
    unknown: 'text-muted-foreground',
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Ficha Técnica</CardTitle>
            <CardDescription>
              {finishedMaterial
                ? `Receita de: ${finishedMaterial.name}`
                : 'Definir receita do produto'}
            </CardDescription>
          </div>

          {/* Painel de CMV atual (quando já existe no banco) */}
          {bomData.id && (
            <div className="text-right space-y-0.5">
              <p className="text-xs text-muted-foreground">CMV salvo no banco</p>
              <p className={`font-semibold text-sm ${costStatusColor[bomData.cost_status as keyof typeof costStatusColor] || ''}`}>
                Total: {fmt(bomData.cached_total_cost)}
              </p>
              <p className={`text-xs ${costStatusColor[bomData.cost_status as keyof typeof costStatusColor] || ''}`}>
                Unitário: {fmt(bomData.cached_unit_cost)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
                Atualizar CMV
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seletor de produto — apenas quando não há material pré-selecionado */}
          {!finishedMaterial && (
            <div className="space-y-1">
              <Label>Produto *</Label>
              <Select
                value={bomData.finished_material_id || ''}
                onValueChange={handleProductSelect}
                disabled={loadingProducts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? 'Carregando...' : 'Selecione o produto acabado ou intermediário'} />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({p.code})</span>
                      {p.material_type === 'intermediate_product' && (
                        <span className="text-xs text-purple-600 ml-1">· Intermediário</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Somente produtos acabados e intermediários podem ter ficha técnica
              </p>
            </div>
          )}

          {/* Campos do formulário — visíveis após selecionar produto */}
          {(finishedMaterial || bomData.finished_material_id) && <>

          {/* Rendimento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="yield_quantity">Rendimento</Label>
              <NumericInput
                id="yield_quantity"
                step="0.01"
                min="0.01"
                value={bomData.yield_quantity}
                onChange={(e) => setBomData(prev => ({ ...prev, yield_quantity: parseFloat(e.target.value) || 1 }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="yield_unit">Unidade</Label>
              <Select value={bomData.yield_unit} onValueChange={(v) => setBomData(prev => ({ ...prev, yield_unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yieldUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="waste_percent">% Perda Geral</Label>
              <NumericInput
                id="waste_percent"
                step="0.1"
                min="0"
                max="100"
                value={bomData.waste_percent}
                onChange={(e) => setBomData(prev => ({ ...prev, waste_percent: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações / Modo de Preparo</Label>
            <Textarea
              id="notes"
              value={bomData.notes}
              onChange={(e) => setBomData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Instruções de preparo, observações..."
              rows={2}
            />
          </div>

          {/* Componentes */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Componentes da Receita</Label>
              <Button type="button" onClick={addBOMItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {bomData.items.map((item, index) => {
                const mat = materials.find(m => m.id === item.material_id);
                const itemCost = getItemCost(item);

                // Opções para o Combobox de ingredientes
                const materialOptions = materials.map(m => ({
                  value: m.id,
                  label: m.name,
                  searchText: `${m.name} ${m.code} ${TYPE_LABELS[m.material_type] || ''}`,
                }));

                return (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/20"
                  >
                    {/* Material (5 colunas) — Combobox com busca */}
                    <div className="col-span-5">
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Material</Label>}
                      <Combobox
                        options={materialOptions}
                        value={item.material_id}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar ingrediente..."
                        emptyText="Nenhum ingrediente encontrado."
                        onSelect={(v) => updateBOMItem(index, 'material_id', v)}
                        className="h-8 text-sm font-normal"
                      />
                    </div>

                    {/* Quantidade (2 colunas) */}
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Qtd</Label>}
                      <NumericInput
                        step="0.001"
                        min="0"
                        value={item.quantity || ''}
                        onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Unidade — vem do cadastro do material (somente leitura) */}
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unidade</Label>}
                      <div className="h-8 flex items-center text-sm text-muted-foreground px-1" title="Unidade de uso definida no cadastro do material">
                        {materials.find(m => m.id === item.material_id)?.usage_unit || item.unit || '—'}
                      </div>
                    </div>

                    {/* Custo estimado do item (2 colunas) */}
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Custo (est.)</Label>}
                      <div className={`h-8 flex items-center text-sm font-medium ${itemCost != null ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {itemCost != null ? fmt(itemCost) : '—'}
                      </div>
                    </div>

                    {/* Remover */}
                    <div className="col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeBOMItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {bomData.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <p className="text-sm">Nenhum componente adicionado</p>
                  <p className="text-xs mt-1">Clique em "Adicionar" para incluir insumos ou produtos intermediários</p>
                </div>
              )}
            </div>
          </div>

          {/* Resumo de CMV estimado */}
          {bomData.items.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-1">
              <p className="text-sm font-semibold text-foreground">Estimativa de CMV</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo total da receita</span>
                <span className="font-medium">{fmt(estimatedTotalCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Custo unitário ({bomData.yield_quantity} {bomData.yield_unit})
                </span>
                <span className="font-semibold text-primary">{fmt(estimatedUnitCost)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                * Baseado nos preços médios ponderados das últimas compras
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Ficha Técnica'}
            </Button>
          </div>

          </> /* end conditional fields block */}

          {/* Botão cancelar sempre visível (mesmo sem produto selecionado) */}
          {!finishedMaterial && !bomData.finished_material_id && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

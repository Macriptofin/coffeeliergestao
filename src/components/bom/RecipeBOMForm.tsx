import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Material {
  id: string;
  name: string;
  code: string;
  usage_unit: string;
  material_type: string;
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
}

interface RecipeBOMFormProps {
  finishedMaterial?: Material;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RecipeBOMForm: React.FC<RecipeBOMFormProps> = ({
  finishedMaterial,
  onSuccess,
  onCancel
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomData, setBomData] = useState<RecipeBOM>({
    finished_material_id: finishedMaterial?.id || '',
    yield_quantity: 1,
    yield_unit: 'unidade',
    waste_percent: 0,
    notes: '',
    items: []
  });

  useEffect(() => {
    loadMaterials();
    if (finishedMaterial?.id) {
      loadExistingBOM();
    }
  }, [finishedMaterial]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, material_type')
        .in('material_type', ['ingredient', 'packaging'])
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    }
  };

  const loadExistingBOM = async () => {
    if (!finishedMaterial?.id) return;

    try {
      const { data: bomData, error: bomError } = await supabase
        .from('recipes_bom')
        .select(`
          *,
          recipe_bom_items (*)
        `)
        .eq('finished_material_id', finishedMaterial.id)
        .single();

      if (bomError && bomError.code !== 'PGRST116') throw bomError;

      if (bomData) {
        setBomData({
          id: bomData.id,
          finished_material_id: bomData.finished_material_id,
          yield_quantity: bomData.yield_quantity,
          yield_unit: bomData.yield_unit,
          waste_percent: bomData.waste_percent,
          notes: bomData.notes || '',
          items: bomData.recipe_bom_items.map((item: any) => ({
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

  const addBOMItem = () => {
    const newItem: BOMItem = {
      material_id: '',
      quantity: 0,
      unit: 'g',
      waste_percent: 0,
      is_packaging: false,
      position: bomData.items.length + 1
    };
    setBomData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateBOMItem = (index: number, field: keyof BOMItem, value: any) => {
    setBomData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
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
    
    if (!bomData.finished_material_id || bomData.items.length === 0) {
      toast.error('Produto acabado e pelo menos um item são obrigatórios');
      return;
    }

    setLoading(true);

    try {
      let bomId = bomData.id;

      // Inserir ou atualizar BOM principal
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

        // Remover itens existentes
        await supabase
          .from('recipe_bom_items')
          .delete()
          .eq('recipe_id', bomId);
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

      // Inserir novos itens
      const itemsToInsert = bomData.items.map((item, index) => ({
        recipe_id: bomId,
        material_id: item.material_id,
        quantity: item.quantity,
        unit: item.unit,
        waste_percent: item.waste_percent,
        is_packaging: item.is_packaging,
        position: index + 1
      }));

      const { error: itemsError } = await supabase
        .from('recipe_bom_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('BOM salva com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar BOM:', error);
      toast.error('Erro ao salvar BOM');
    } finally {
      setLoading(false);
    }
  };

  const yieldUnits = ['unidade', 'kg', 'g', 'porção'];
  const usageUnits = ['g', 'kg', 'ml', 'l', 'unidade'];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>BOM - Produto Acabado</CardTitle>
        <CardDescription>
          {finishedMaterial ? `Configurar BOM para: ${finishedMaterial.name}` : 'Definir estrutura do produto acabado'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="yield_quantity">Rendimento</Label>
              <Input
                id="yield_quantity"
                type="number"
                step="0.01"
                value={bomData.yield_quantity}
                onChange={(e) => setBomData(prev => ({ ...prev, yield_quantity: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="yield_unit">Unidade do Rendimento</Label>
              <Select value={bomData.yield_unit} onValueChange={(value) => setBomData(prev => ({ ...prev, yield_unit: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yieldUnits.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="waste_percent">% Perda Geral</Label>
              <Input
                id="waste_percent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={bomData.waste_percent}
                onChange={(e) => setBomData(prev => ({ ...prev, waste_percent: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={bomData.notes}
              onChange={(e) => setBomData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Instruções especiais, observações..."
            />
          </div>

          {/* Lista de itens */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Componentes da Receita</Label>
              <Button type="button" onClick={addBOMItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {bomData.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div>
                      <Label>Material</Label>
                      <Select 
                        value={item.material_id} 
                        onValueChange={(value) => updateBOMItem(index, 'material_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map(material => (
                            <SelectItem key={material.id} value={material.id}>
                              <div className="flex items-center gap-2">
                                <span>{material.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {material.code}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <Label>Unidade</Label>
                      <Select 
                        value={item.unit} 
                        onValueChange={(value) => updateBOMItem(index, 'unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {usageUnits.map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>% Perda</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={item.waste_percent}
                        onChange={(e) => updateBOMItem(index, 'waste_percent', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`packaging-${index}`}
                        checked={item.is_packaging}
                        onCheckedChange={(checked) => updateBOMItem(index, 'is_packaging', checked)}
                      />
                      <Label htmlFor={`packaging-${index}`} className="text-sm">Embalagem</Label>
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeBOMItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}

              {bomData.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum componente adicionado</p>
                  <p className="text-sm">Clique em "Adicionar Item" para começar</p>
                </div>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar BOM'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
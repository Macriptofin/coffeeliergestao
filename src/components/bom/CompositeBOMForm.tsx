import React, { useState, useEffect } from 'react';
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
import { Trash2, Plus } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  code: string;
  usage_unit: string;
  material_type: string;
}

interface CompositeBOMItem {
  id?: string;
  component_material_id: string;
  quantity: number;
  unit: string;
  position: number;
}

interface CompositeBOM {
  id?: string;
  composite_material_id: string;
  notes?: string;
  items: CompositeBOMItem[];
}

interface CompositeBOMFormProps {
  compositeMaterial?: Material;
  onSuccess: () => void;
  onCancel: () => void;
}

export const CompositeBOMForm: React.FC<CompositeBOMFormProps> = ({
  compositeMaterial,
  onSuccess,
  onCancel
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomData, setBomData] = useState<CompositeBOM>({
    composite_material_id: compositeMaterial?.id || '',
    notes: '',
    items: []
  });

  useEffect(() => {
    loadMaterials();
    if (compositeMaterial?.id) {
      loadExistingBOM();
    }
  }, [compositeMaterial]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, material_type')
        .neq('id', compositeMaterial?.id) // Não incluir o próprio material composto
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    }
  };

  const loadExistingBOM = async () => {
    if (!compositeMaterial?.id) return;

    try {
      const { data: bomData, error: bomError } = await supabase
        .from('composites_bom')
        .select(`
          *,
          composite_bom_items (*)
        `)
        .eq('composite_material_id', compositeMaterial.id)
        .single();

      if (bomError && bomError.code !== 'PGRST116') throw bomError;

      if (bomData) {
        setBomData({
          id: bomData.id,
          composite_material_id: bomData.composite_material_id,
          notes: bomData.notes || '',
          items: bomData.composite_bom_items.map((item: any) => ({
            id: item.id,
            component_material_id: item.component_material_id,
            quantity: item.quantity,
            unit: item.unit,
            position: item.position
          }))
        });
      }
    } catch (error) {
      console.error('Erro ao carregar BOM existente:', error);
    }
  };

  const addBOMItem = () => {
    const newItem: CompositeBOMItem = {
      component_material_id: '',
      quantity: 1,
      unit: 'un',
      position: bomData.items.length + 1
    };
    setBomData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateBOMItem = (index: number, field: keyof CompositeBOMItem, value: any) => {
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
    
    if (!bomData.composite_material_id || bomData.items.length === 0) {
      toast.error('Produto composto e pelo menos um item são obrigatórios');
      return;
    }

    setLoading(true);

    try {
      let bomId = bomData.id;

      // Inserir ou atualizar BOM principal
      if (bomId) {
        const { error } = await supabase
          .from('composites_bom')
          .update({
            notes: bomData.notes
          })
          .eq('id', bomId);

        if (error) throw error;

        // Remover itens existentes
        await supabase
          .from('composite_bom_items')
          .delete()
          .eq('composite_id', bomId);
      } else {
        const { data, error } = await supabase
          .from('composites_bom')
          .insert({
            composite_material_id: bomData.composite_material_id,
            notes: bomData.notes
          })
          .select()
          .single();

        if (error) throw error;
        bomId = data.id;
      }

      // Inserir novos itens
      const itemsToInsert = bomData.items.map((item, index) => ({
        composite_id: bomId,
        component_material_id: item.component_material_id,
        quantity: item.quantity,
        unit: item.unit,
        position: index + 1
      }));

      const { error: itemsError } = await supabase
        .from('composite_bom_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success('BOM de produto composto salva com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar BOM:', error);
      toast.error('Erro ao salvar BOM');
    } finally {
      setLoading(false);
    }
  };

  const usageUnits = MEASUREMENT_UNITS;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>BOM - Produto Composto</CardTitle>
        <CardDescription>
          {compositeMaterial ? `Configurar composição para: ${compositeMaterial.name}` : 'Definir estrutura do produto composto'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={bomData.notes}
              onChange={(e) => setBomData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Instruções de montagem, observações especiais..."
            />
          </div>

          {/* Lista de itens */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Componentes do Kit/Conjunto</Label>
              <Button type="button" onClick={addBOMItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Componente
              </Button>
            </div>

            <div className="space-y-3">
              {bomData.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <Label>Material Componente</Label>
                      <Select 
                        value={item.component_material_id} 
                        onValueChange={(value) => updateBOMItem(index, 'component_material_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar componente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map(material => (
                            <SelectItem key={material.id} value={material.id}>
                              <div className="flex items-center gap-2">
                                <span>{material.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {material.code}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {material.material_type}
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
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
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

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeBOMItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {bomData.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum componente adicionado</p>
                  <p className="text-sm">Clique em "Adicionar Componente" para começar</p>
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
              {loading ? 'Salvando...' : 'Salvar Composição'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
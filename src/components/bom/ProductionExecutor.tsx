import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Package, Wrench } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Material {
  id: string;
  name: string;
  code: string;
  material_type: string;
}

interface ProductionExecutorProps {
  onSuccess?: () => void;
}

export const ProductionExecutor: React.FC<ProductionExecutorProps> = ({ onSuccess }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [materialType, setMaterialType] = useState<'finished_product' | 'composite_product' | ''>('');

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, code, material_type')
        .in('material_type', ['finished_product', 'composite_product'])
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    }
  };

  const executeProduction = async (type: 'finished' | 'composite') => {
    if (!selectedMaterial || quantity <= 0) {
      toast.error('Selecione um material e informe a quantidade');
      return;
    }

    setLoading(true);

    try {
      if (type === 'finished') {
        const { error } = await supabase.rpc('produce_finished_product', {
          p_finished_material: selectedMaterial,
          p_output_qty: quantity
        });

        if (error) throw error;
        toast.success(`Produção de ${quantity} unidade(s) executada com sucesso!`);
      } else {
        const { error } = await supabase.rpc('assemble_composite', {
          p_composite_material: selectedMaterial,
          p_qty: quantity
        });

        if (error) throw error;
        toast.success(`Montagem de ${quantity} unidade(s) executada com sucesso!`);
      }

      setSelectedMaterial('');
      setQuantity(1);
      setMaterialType('');
      onSuccess?.();
    } catch (error) {
      console.error('Erro na execução:', error);
      toast.error('Erro ao executar operação: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterialData = materials.find(m => m.id === selectedMaterial);
  const filteredMaterials = materialType ? 
    materials.filter(m => m.material_type === materialType) : 
    materials;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Produção de Produtos Acabados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Produzir Produto Acabado
          </CardTitle>
          <CardDescription>
            Executa a produção consumindo ingredientes conforme BOM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Produto Acabado</Label>
            <Select 
              value={materialType === 'finished_product' ? selectedMaterial : ''} 
              onValueChange={(value) => {
                setSelectedMaterial(value);
                setMaterialType('finished_product');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto acabado..." />
              </SelectTrigger>
              <SelectContent>
                {materials.filter(m => m.material_type === 'finished_product').map(material => (
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
            <Label>Quantidade a Produzir</Label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              disabled={materialType !== 'finished_product'}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="w-full" 
                disabled={!selectedMaterial || materialType !== 'finished_product' || quantity <= 0}
              >
                <Play className="h-4 w-4 mr-2" />
                Executar Produção
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Produção</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto irá:
                  <br />• Consumir os ingredientes do estoque conforme BOM
                  <br />• Adicionar {quantity} unidade(s) de {selectedMaterialData?.name} ao estoque
                  <br />• Registrar todas as movimentações
                  <br /><br />
                  Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button onClick={() => executeProduction('finished')} disabled={loading}>
                  {loading ? 'Executando...' : 'Confirmar'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Montagem de Produtos Compostos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            Montar Produto Composto
          </CardTitle>
          <CardDescription>
            Monta kits/conjuntos consumindo componentes do estoque
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Produto Composto</Label>
            <Select 
              value={materialType === 'composite_product' ? selectedMaterial : ''} 
              onValueChange={(value) => {
                setSelectedMaterial(value);
                setMaterialType('composite_product');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto composto..." />
              </SelectTrigger>
              <SelectContent>
                {materials.filter(m => m.material_type === 'composite_product').map(material => (
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
            <Label>Quantidade a Montar</Label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              disabled={materialType !== 'composite_product'}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700" 
                disabled={!selectedMaterial || materialType !== 'composite_product' || quantity <= 0}
              >
                <Wrench className="h-4 w-4 mr-2" />
                Executar Montagem
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Montagem</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto irá:
                  <br />• Consumir os componentes do estoque conforme composição
                  <br />• Registrar movimentações de saída dos componentes
                  <br />• Montar {quantity} unidade(s) de {selectedMaterialData?.name}
                  <br /><br />
                  Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button 
                  onClick={() => executeProduction('composite')} 
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? 'Executando...' : 'Confirmar'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};
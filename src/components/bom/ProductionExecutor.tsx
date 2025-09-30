import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, Package, Wrench, Settings } from 'lucide-react';
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
      // Buscar apenas materiais que têm BOM configurado
      const [finishedProductsQuery, compositeProductsQuery] = await Promise.all([
        // Produtos acabados e intermediários com BOM
        supabase
          .from('materials')
          .select(`
            id, name, code, material_type,
            recipes_bom!inner(id)
          `)
          .in('material_type', ['finished_product', 'intermediate_product'])
          .order('name'),
        
        // Produtos compostos com BOM  
        supabase
          .from('materials')
          .select(`
            id, name, code, material_type,
            composites_bom!inner(id)
          `)
          .eq('material_type', 'composite_product')
          .order('name')
      ]);

      if (finishedProductsQuery.error) throw finishedProductsQuery.error;
      if (compositeProductsQuery.error) throw compositeProductsQuery.error;

      const finishedProducts = (finishedProductsQuery.data || []).map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        material_type: item.material_type
      }));

      const compositeProducts = (compositeProductsQuery.data || []).map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        material_type: item.material_type
      }));

      setMaterials([...finishedProducts, ...compositeProducts]);
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
      {materials.length === 0 && (
        <div className="col-span-full">
          <Card className="border-dashed border-muted-foreground/25">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum produto com BOM configurado</h3>
                <p className="text-muted-foreground mb-4">
                  Configure primeiro as fichas técnicas (BOMs) dos seus produtos para poder executar a produção.
                </p>
                <Button onClick={() => window.location.href = '/producao/fichas-tecnicas'}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Fichas Técnicas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {materials.length > 0 && (
        <>
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
                <Label>Produto para Produção</Label>
                <Select 
                  value={selectedMaterial} 
                  onValueChange={(value) => {
                    setSelectedMaterial(value);
                    const material = materials.find(m => m.id === value);
                    if (material) {
                      setMaterialType(material.material_type as 'finished_product' | 'composite_product');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar produto acabado ou intermediário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.filter(m => m.material_type === 'finished_product' || m.material_type === 'intermediate_product').length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhum produto com BOM configurado
                      </div>
                    ) : (
                      materials
                        .filter(m => m.material_type === 'finished_product' || m.material_type === 'intermediate_product')
                        .map(material => (
                          <SelectItem key={material.id} value={material.id}>
                            <div className="flex items-center gap-2">
                              <span>{material.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {material.code}
                              </Badge>
                              {material.material_type === 'intermediate_product' && (
                                <Badge variant="secondary" className="text-xs">
                                  Intermediário
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                    )}
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
                  disabled={!selectedMaterial || (materialType !== 'finished_product' && materialType !== 'composite_product')}
                />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="w-full" 
                    disabled={!selectedMaterial || quantity <= 0 || (materialType !== 'finished_product' && materialType !== 'composite_product')}
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
                    {materials.filter(m => m.material_type === 'composite_product').length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhum produto composto com BOM configurado
                      </div>
                    ) : (
                      materials.filter(m => m.material_type === 'composite_product').map(material => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            <span>{material.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {material.code}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
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
        </>
      )}
    </div>
  );
};
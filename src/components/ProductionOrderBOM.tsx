import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import { Plus, Minus, Printer, FileDown, ShoppingCart, X } from "lucide-react";
import { PrintableProductionOrder } from "./PrintableProductionOrder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  subcategory?: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
  price_per_purchase_unit: number;
}

interface BOMItem {
  id: string;
  quantity: number;
  unit: string;
  position: number;
  is_packaging: boolean;
  material: Material;
  notes?: string;
}

interface BOM {
  id: string;
  yield_quantity: number;
  yield_unit?: string;
  notes?: string;
  finished_material: Material;
  recipe_bom_items: BOMItem[];
}

interface ProductionOrderBOMProps {
  onClose?: () => void;
}

interface ProductionItem {
  bomId: string;
  quantity: number;
  multiplier: number;
}

interface ConsolidatedIngredient {
  material: Material;
  totalQuantity: number;
  totalCost: number;
  usedInBOMs: { bomName: string; quantity: number }[];
}

export const ProductionOrderBOM = ({ onClose }: ProductionOrderBOMProps) => {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [selectedBOM, setSelectedBOM] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [multiplier, setMultiplier] = useState('1');
  const [orderName, setOrderName] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBOMs();
  }, []);

  const loadBOMs = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes_bom')
        .select(`
          id,
          yield_quantity,
          yield_unit,
          notes,
          materials!recipes_bom_finished_material_id_fkey(
            id,
            name,
            code,
            category,
            subcategory,
            material_type,
            purchase_unit,
            usage_unit,
            conversion_factor,
            price_per_purchase_unit
          ),
          recipe_bom_items(
            id,
            quantity,
            unit,
            position,
            is_packaging,
            notes,
            materials!recipe_bom_items_material_id_fkey(
              id,
              name,
              code,
              category,
              subcategory,
              material_type,
              purchase_unit,
              usage_unit,
              conversion_factor,
              price_per_purchase_unit
            )
          )
        `)
        .order('materials(name)');

      if (error) throw error;

      const formattedBOMs = data.map(bom => ({
        id: bom.id,
        yield_quantity: bom.yield_quantity,
        yield_unit: bom.yield_unit,
        notes: bom.notes,
        finished_material: bom.materials as Material,
        recipe_bom_items: bom.recipe_bom_items
          .map(item => ({
            id: item.id,
            quantity: item.quantity,
            unit: item.unit,
            position: item.position,
            is_packaging: item.is_packaging,
            notes: item.notes,
            material: item.materials as Material
          }))
          .sort((a, b) => a.position - b.position)
      }));

      setBoms(formattedBOMs);
    } catch (error) {
      console.error('Erro ao carregar BOMs:', error);
      toast.error('Erro ao carregar fichas técnicas');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ordem_Producao_BOM_${orderName.replace(/\s+/g, '_') || 'Sem_Nome'}`,
  });

  const addProductionItem = () => {
    if (!selectedBOM || !quantity || !multiplier) return;
    
    const existingIndex = productionItems.findIndex(item => item.bomId === selectedBOM);
    
    if (existingIndex >= 0) {
      const updated = [...productionItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: parseInt(quantity),
        multiplier: parseFloat(multiplier)
      };
      setProductionItems(updated);
    } else {
      setProductionItems([
        ...productionItems,
        {
          bomId: selectedBOM,
          quantity: parseInt(quantity),
          multiplier: parseFloat(multiplier)
        }
      ]);
    }
    
    setSelectedBOM('');
    setQuantity('1');
    setMultiplier('1');
  };

  const removeProductionItem = (bomId: string) => {
    setProductionItems(productionItems.filter(item => item.bomId !== bomId));
  };

  const updateProductionItem = (bomId: string, field: keyof ProductionItem, value: number) => {
    setProductionItems(productionItems.map(item => 
      item.bomId === bomId ? { ...item, [field]: value } : item
    ));
  };

  const consolidateIngredients = (): ConsolidatedIngredient[] => {
    const consolidated: { [key: string]: ConsolidatedIngredient } = {};

    productionItems.forEach(productionItem => {
      const bom = boms.find(b => b.id === productionItem.bomId);
      if (!bom) return;

      bom.recipe_bom_items.forEach(bomItem => {
        const material = bomItem.material;
        if (!material) return;

        const totalNeeded = bomItem.quantity * productionItem.quantity * productionItem.multiplier;
        const pricePerUsage = material.price_per_purchase_unit / material.conversion_factor;
        const cost = totalNeeded * pricePerUsage;

        if (consolidated[material.id]) {
          consolidated[material.id].totalQuantity += totalNeeded;
          consolidated[material.id].totalCost += cost;
          consolidated[material.id].usedInBOMs.push({
            bomName: bom.finished_material.name,
            quantity: totalNeeded
          });
        } else {
          consolidated[material.id] = {
            material,
            totalQuantity: totalNeeded,
            totalCost: cost,
            usedInBOMs: [{
              bomName: bom.finished_material.name,
              quantity: totalNeeded
            }]
          };
        }
      });
    });

    return Object.values(consolidated).sort((a, b) => a.material.name.localeCompare(b.material.name));
  };

  const getTotalProductionCost = () => {
    return consolidateIngredients().reduce((total, item) => total + item.totalCost, 0);
  };

  const saveProductionOrder = async () => {
    if (productionItems.length === 0) {
      toast.error('Adicione pelo menos uma ficha técnica à ordem');
      return;
    }

    if (!orderName.trim()) {
      toast.error('Informe um nome para a ordem de produção');
      return;
    }

    try {
      setLoading(true);

      // Salvar ordem de produção
      const { data: order, error: orderError } = await supabase
        .from('bom_production_orders')
        .insert({
          order_name: orderName,
          order_date: orderDate,
          total_cost: totalCost,
          notes: 'Ordem criada via interface BOM'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Salvar itens da ordem
      const orderItemsData = productionItems.map((item, index) => {
        const bom = boms.find(b => b.id === item.bomId);
        const totalYield = bom!.yield_quantity * item.quantity * item.multiplier;
        
        return {
          production_order_id: order.id,
          bom_id: item.bomId,
          quantity: item.quantity,
          multiplier: item.multiplier,
          total_yield_quantity: totalYield,
          yield_unit: bom!.yield_unit || 'un',
          position: index + 1
        };
      });

      const { error: itemsError } = await supabase
        .from('bom_production_order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // Salvar materiais consolidados
      const consolidatedData = consolidatedIngredients.map(item => ({
        production_order_id: order.id,
        material_id: item.material.id,
        total_quantity: item.totalQuantity,
        unit: item.material.usage_unit,
        total_cost: item.totalCost,
        used_in_boms: JSON.stringify(item.usedInBOMs)
      }));

      const { error: materialsError } = await supabase
        .from('bom_production_consolidated_materials')
        .insert(consolidatedData);

      if (materialsError) throw materialsError;

      toast.success('Ordem de produção salva com sucesso!');
      
      // Limpar formulário
      setProductionItems([]);
      setOrderName('');
      setOrderDate(new Date().toISOString().split('T')[0]);
      
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar ordem de produção');
    } finally {
      setLoading(false);
    }
  };

  const consolidatedIngredients = consolidateIngredients();
  const totalCost = getTotalProductionCost();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (boms.length === 0) {
    return (
      <Card className="shadow-elegant">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma ficha técnica encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Configure primeiro as fichas técnicas (BOMs) dos seus produtos para criar ordens de produção.
            </p>
            <Button onClick={() => window.location.href = '/producao/fichas-tecnicas'}>
              <Plus className="h-4 w-4 mr-2" />
              Configurar Fichas Técnicas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Criar Ordem de Produção (BOM)
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações da Ordem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderName">Nome da Ordem</Label>
              <Input
                id="orderName"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="Ex: Produção Semanal - Bolos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderDate">Data de Produção</Label>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
          </div>

          {/* Adicionar Fichas Técnicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Adicionar Fichas Técnicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <Select value={selectedBOM} onValueChange={setSelectedBOM}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione uma ficha técnica" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {boms.map((bom) => (
                      <SelectItem key={bom.id} value={bom.id}>
                        <div className="flex items-center gap-2">
                          <span>{bom.finished_material.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {bom.finished_material.code}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Multiplicador</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="1.0"
                />
              </div>
              
              <Button 
                onClick={addProductionItem} 
                disabled={!selectedBOM || !quantity || !multiplier}
                className="h-10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de Fichas Técnicas na Produção */}
          {productionItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Fichas Técnicas na Ordem</h3>
              
              <div className="space-y-3">
                {productionItems.map((productionItem) => {
                  const bom = boms.find(b => b.id === productionItem.bomId);
                  if (!bom) return null;
                  
                  const totalYield = bom.yield_quantity * productionItem.quantity * productionItem.multiplier;
                  
                  return (
                    <div key={productionItem.bomId} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{bom.finished_material.name}</h4>
                          <Badge variant="secondary">{bom.finished_material.category}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {bom.finished_material.code}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Rendimento original: {bom.yield_quantity} {bom.yield_unit || 'un'} | 
                          Total produzido: {totalYield} {bom.yield_unit || 'un'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <Label className="text-xs">Qtd</Label>
                            <Input
                              type="number"
                              min="1"
                              value={productionItem.quantity}
                              onChange={(e) => updateProductionItem(productionItem.bomId, 'quantity', parseInt(e.target.value))}
                              className="w-16 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Mult</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={productionItem.multiplier}
                              onChange={(e) => updateProductionItem(productionItem.bomId, 'multiplier', parseFloat(e.target.value))}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProductionItem(productionItem.bomId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Resumo Total */}
                <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Custo Total</div>
                    <div className="text-xl font-bold text-primary">R$ {totalCost.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista Consolidada de Ingredientes */}
          {consolidatedIngredients.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Lista de Compras Consolidada</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {consolidatedIngredients.map((item) => (
                  <Card key={item.material.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm">{item.material.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {item.material.usage_unit}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Quantidade:</span>
                          <span className="font-semibold">{item.totalQuantity.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Custo:</span>
                          <span className="font-semibold text-primary">R$ {item.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {item.usedInBOMs.length > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Usado em {item.usedInBOMs.length} produtos
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          {productionItems.length > 0 && (
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={saveProductionOrder}
                disabled={!orderName.trim() || loading}
                className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Ordem'}
              </Button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary flex-1">
                    <Printer className="h-4 w-4 mr-2" />
                    Gerar Ordem de Produção
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4 no-print">
                      <h3 className="text-lg font-semibold">Ordem de Produção (BOM)</h3>
                      <Button onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>
                    <div ref={printRef}>
                      <div className="bg-white p-6 print:p-0">
                        <div className="text-center mb-6">
                          <h1 className="text-2xl font-bold">Ordem de Produção</h1>
                          <p className="text-muted-foreground">{orderName || 'Sem nome'}</p>
                          <p className="text-sm">Data: {new Date(orderDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                        
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-3">Produtos a Produzir</h3>
                          {productionItems.map((item) => {
                            const bom = boms.find(b => b.id === item.bomId);
                            if (!bom) return null;
                            
                            return (
                              <div key={item.bomId} className="border-b pb-2 mb-2">
                                <div className="flex justify-between">
                                  <span className="font-medium">{bom.finished_material.name}</span>
                                  <span>{item.quantity} x {item.multiplier} = {bom.yield_quantity * item.quantity * item.multiplier} {bom.yield_unit || 'un'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-3">Lista de Materiais</h3>
                          <table className="w-full border-collapse border border-gray-300">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2 text-left">Material</th>
                                <th className="border border-gray-300 p-2 text-center">Quantidade</th>
                                <th className="border border-gray-300 p-2 text-center">Unidade</th>
                                <th className="border border-gray-300 p-2 text-right">Custo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consolidatedIngredients.map((item) => (
                                <tr key={item.material.id}>
                                  <td className="border border-gray-300 p-2">{item.material.name}</td>
                                  <td className="border border-gray-300 p-2 text-center">{item.totalQuantity.toFixed(2)}</td>
                                  <td className="border border-gray-300 p-2 text-center">{item.material.usage_unit}</td>
                                  <td className="border border-gray-300 p-2 text-right">R$ {item.totalCost.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 font-bold">
                                <td className="border border-gray-300 p-2" colSpan={3}>TOTAL</td>
                                <td className="border border-gray-300 p-2 text-right">R$ {totalCost.toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
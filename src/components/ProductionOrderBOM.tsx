import { useState, useRef, useEffect } from "react";
import { todayLocalISO } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import { Plus, Minus, Printer, FileDown, ShoppingCart, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { PrintableBOMProductionOrder } from "./PrintableBOMProductionOrder";
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
  const [orderDate, setOrderDate] = useState(todayLocalISO());
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBOMs();
    loadStockItems();
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

  const loadStockItems = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select('material_id, current_quantity, average_price');
      
      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ordem_Producao_BOM_${orderName.replace(/\s+/g, '_') || 'Sem_Nome'}`,
  });

  const saveProductionOrder = async () => {
    if (productionItems.length === 0) {
      toast.error('Adicione pelo menos uma ficha técnica à ordem');
      return;
    }

    if (!orderName.trim()) {
      toast.error('Nome da ordem é obrigatório');
      return;
    }

    try {
      const consolidatedIngredients = consolidateIngredients();
      const totalCost = consolidatedIngredients.reduce((total, item) => total + item.totalCost, 0);

      // 1. Criar a ordem de produção
      const { data: productionOrder, error: productionOrderError } = await supabase
        .from('bom_production_orders')
        .insert({
          order_name: orderName.trim(),
          order_date: orderDate,
          total_cost: totalCost,
          notes: `Ordem criada com ${productionItems.length} ficha(s) técnica(s)`,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (productionOrderError) throw productionOrderError;

      // 2. Inserir itens da ordem
      const orderItems = productionItems.map((item, index) => {
        const bom = boms.find(b => b.id === item.bomId)!;
        const totalYield = bom.yield_quantity * item.quantity * item.multiplier;
        const itemIngredients = bom.recipe_bom_items.map(bomItem => {
          const totalNeeded = bomItem.quantity * item.quantity * item.multiplier;
          const pricePerPurchase = bomItem.material.price_per_purchase_unit || 0;
          const conversionFactor = bomItem.material.conversion_factor || 1;
          const pricePerUsage = pricePerPurchase / conversionFactor;
          return totalNeeded * pricePerUsage;
        });
        const itemCost = itemIngredients.reduce((sum, cost) => sum + cost, 0);

        return {
          production_order_id: productionOrder.id,
          bom_id: item.bomId,
          quantity: item.quantity,
          multiplier: item.multiplier,
          total_yield_quantity: totalYield,
          yield_unit: bom.yield_unit || 'un',
          item_cost: itemCost,
          position: index + 1
        };
      });

      const { error: orderItemsError } = await supabase
        .from('bom_production_order_items')
        .insert(orderItems);

      if (orderItemsError) throw orderItemsError;

      // 3. Inserir materiais consolidados
      const consolidatedMaterials = consolidatedIngredients.map(ingredient => ({
        production_order_id: productionOrder.id,
        material_id: ingredient.material.id,
        total_quantity: ingredient.totalQuantity,
        unit: ingredient.material.usage_unit,
        total_cost: ingredient.totalCost,
        used_in_boms: ingredient.usedInBOMs
      }));

      const { error: consolidatedMaterialsError } = await supabase
        .from('bom_production_consolidated_materials')
        .insert(consolidatedMaterials);

      if (consolidatedMaterialsError) throw consolidatedMaterialsError;

      toast.success('Ordem de produção criada com sucesso! Validação de estoque disponível no módulo de compras.');
      
      // Limpar formulário
      setProductionItems([]);
      setOrderName('');
      setOrderDate(todayLocalISO());
      
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao criar ordem de produção');
    }
  };

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
        
        // Buscar preço médio do estoque (persiste mesmo com estoque zerado)
        const stockItem = stockItems.find(s => s.material_id === material.id);
        const averagePrice = stockItem?.average_price || 0;
        
        // Se não houver preço médio no estoque, usar price_per_purchase_unit como fallback
        let pricePerUsage = averagePrice;
        if (!pricePerUsage || pricePerUsage === 0) {
          const pricePerPurchase = material.price_per_purchase_unit || 0;
          const conversionFactor = material.conversion_factor || 1;
          pricePerUsage = pricePerPurchase / conversionFactor;
          
          if (pricePerUsage === 0) {
            console.warn(`Material "${material.name}" (${material.code}) sem preço médio ou de compra definido`);
          }
        }
        
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

  const consolidatedIngredients = consolidateIngredients();

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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Ficha Técnica</Label>
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
                
              </div>
            </div>
          )}

          {/* Lista Consolidada de Materiais */}
          {consolidatedIngredients.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Materiais Necessários para Produção</h3>
              
              <div className="grid grid-cols-1 gap-3">
                {consolidatedIngredients.map((item) => {
                  const stockItem = stockItems.find(s => s.material_id === item.material.id);
                  const currentStock = stockItem?.current_quantity || 0;
                  const hasEnoughStock = currentStock >= item.totalQuantity;
                  const difference = currentStock - item.totalQuantity;
                  
                  return (
                    <Card key={item.material.id} className={`p-4 ${!hasEnoughStock ? 'border-destructive/50 bg-destructive/5' : 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        {/* Código e Descrição */}
                        <div className="md:col-span-2">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {item.material.code}
                            </Badge>
                            <div>
                              <h4 className="font-medium text-sm">{item.material.name}</h4>
                              {item.usedInBOMs.length > 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Usado em {item.usedInBOMs.length} produtos
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Unidade de Medida */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Unidade</p>
                          <Badge variant="secondary" className="text-xs">
                            {item.material.usage_unit}
                          </Badge>
                        </div>
                        
                        {/* Necessidade vs Estoque */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Necessidade</p>
                          <p className="font-semibold text-sm">{item.totalQuantity.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Estoque: <span className={!hasEnoughStock ? "text-destructive font-medium" : "text-green-600 dark:text-green-400"}>{currentStock.toFixed(2)}</span>
                          </p>
                        </div>
                        
                        {/* Status */}
                        <div className="text-center">
                          {hasEnoughStock ? (
                            <div className="flex flex-col items-center gap-1">
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <span className="text-xs font-medium text-green-600 dark:text-green-400">Disponível</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              <span className="text-xs font-medium text-destructive">
                                Faltam {Math.abs(difference).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ações */}
          {productionItems.length > 0 && (
            <div className="pt-6 border-t">
              <div className="flex gap-3">
                <Button 
                  onClick={saveProductionOrder}
                  className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Salvar Ordem
                </Button>
                <Button 
                  onClick={handlePrint}
                  variant="outline"
                  className="shadow-soft"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ordem Impressa (Oculta) */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PrintableBOMProductionOrder
            orderName={orderName || 'Ordem de Produção BOM'}
            orderDate={orderDate}
            productionItems={productionItems}
            consolidatedIngredients={consolidatedIngredients}
            boms={boms}
          />
        </div>
      </div>
    </div>
  );
};
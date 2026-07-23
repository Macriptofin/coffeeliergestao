import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Package, Play, CheckCircle, Clock, AlertCircle, Eye, EyeOff, RefreshCcw, Printer, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { PrintableBOMProductionOrder } from './PrintableBOMProductionOrder';
import { ThermalPrintableOrder } from './ThermalPrintableOrder';
import { ProductionChecklist } from './production/ProductionChecklist';
import { ProductionFinalizationDialog } from './production/ProductionFinalizationDialog';

interface ProductionOrder {
  id: string;
  order_name: string;
  order_date: string;
  status: string;
  total_cost: number;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  items: ProductionOrderItem[];
  consolidated_materials: ConsolidatedMaterial[];
}

interface ProductionOrderItem {
  id: string;
  bom_id: string;
  quantity: number;
  multiplier: number;
  total_yield_quantity: number;
  yield_unit: string;
  item_cost: number;
  bom: {
    id: string;
    finished_material: {
      id: string;
      name: string;
      category: string;
      code: string;
      material_type: string;
    };
  };
}

interface ConsolidatedMaterial {
  id: string;
  material_id: string;
  total_quantity: number;
  unit: string;
  total_cost: number;
  is_reserved: boolean;
  is_consumed: boolean;
  reserved_quantity: number;
  consumed_quantity: number;
  used_in_boms: any;
  material: {
    id: string;
    name: string;
    code: string;
    category: string;
    usage_unit: string;
  };
}

const PRODUCTION_ORDERS_QUERY_KEY = ['bom-production-orders'];
const EMPTY_PRODUCTION_ORDERS: ProductionOrder[] = [];
const EMPTY_STOCK_ITEMS: Array<{ material_id: string; current_quantity: number; average_price: number }> = [];

async function fetchBOMProductionOrders(): Promise<ProductionOrder[]> {
  const { data, error } = await supabase
    .from('bom_production_orders')
    .select(`
      *,
      items:bom_production_order_items (
        *,
        bom:recipes_bom (
          id,
          finished_material:materials!recipes_bom_finished_material_id_fkey (
            id, name, category, code, material_type
          )
        )
      ),
      consolidated_materials:bom_production_consolidated_materials (
        *,
        material:materials (
          id, name, code, category, usage_unit
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchStockItemsSummary() {
  const { data, error } = await supabase
    .from('stock_items')
    .select('material_id, current_quantity, average_price');

  if (error) throw error;
  return data || [];
}

export const BOMProductionOrdersList = () => {
  const queryClient = useQueryClient();
  const { data: productionOrders = EMPTY_PRODUCTION_ORDERS, isPending: loading } = useQuery({
    queryKey: PRODUCTION_ORDERS_QUERY_KEY,
    queryFn: fetchBOMProductionOrders,
  });
  const { data: stockItems = EMPTY_STOCK_ITEMS } = useQuery({
    queryKey: ['stock-items-summary'],
    queryFn: fetchStockItemsSummary,
  });
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [showMaterialsDialog, setShowMaterialsDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<ProductionOrder | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [includeTechnicalSheets, setIncludeTechnicalSheets] = useState(false);
  const [technicalSheetsData, setTechnicalSheetsData] = useState<any[]>([]);
  const [checklistOrderId, setChecklistOrderId] = useState<string | null>(null);
  const [finalizingOrder, setFinalizingOrder] = useState<ProductionOrder | null>(null);
  const [thermalOrder, setThermalOrder] = useState<ProductionOrder | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);

  const reloadProductionOrders = () =>
    queryClient.invalidateQueries({ queryKey: PRODUCTION_ORDERS_QUERY_KEY });

  useEffect(() => {
    // Subscribe to realtime changes for automatic refresh
    const channel = supabase
      .channel('bom-production-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bom_production_orders'
        },
        () => {
          reloadProductionOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setProcessingOrder(orderId);
    try {
      const { error } = await supabase.rpc('update_production_order_status', {
        p_production_order_id: orderId,
        p_new_status: newStatus
      });

      if (error) throw error;

      await reloadProductionOrders();
      toast.success(`Ordem ${getStatusLabel(newStatus).toLowerCase()}!`);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status da ordem');
    } finally {
      setProcessingOrder(null);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const showMaterialsDetails = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setShowMaterialsDialog(true);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ordem_Producao_BOM_${orderToPrint?.order_name.replace(/\s+/g, '_') || 'Sem_Nome'}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 1cm;
      }
      @media print {
        body {
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          color: black !important;
          background: white !important;
        }
        .print-recipe {
          page-break-inside: avoid;
        }
        .page-break-before {
          page-break-before: always;
        }
        .page-break-inside-avoid {
          page-break-inside: avoid;
        }
        table {
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
      }
    `,
  });

  const prepareForPrint = (order: ProductionOrder) => {
    setOrderToPrint(order);
    setIncludeTechnicalSheets(false);
    setTechnicalSheetsData([]);
    setShowPrintDialog(true);
  };

  const handleThermalPrint = useReactToPrint({
    contentRef: thermalRef,
    documentTitle: `Ordem_Producao_Termica_${thermalOrder?.order_name.replace(/\s+/g, '_') || 'Sem_Nome'}`,
    pageStyle: '@page { size: 80mm auto; margin: 3mm; } body { margin: 0; }',
  });

  const printThermal = (order: ProductionOrder) => {
    setThermalOrder(order);
    setTimeout(() => handleThermalPrint(), 100);
  };

  const loadTechnicalSheetRecursive = async (materialId: string, processedIds: Set<string> = new Set()): Promise<any[]> => {
    // Evita loops infinitos
    if (processedIds.has(materialId)) return [];
    processedIds.add(materialId);

    const sheets: any[] = [];

    try {
      // Busca ficha técnica do material (recipes_bom)
      const { data: bomData, error: bomError } = await supabase
        .from('recipes_bom')
        .select(`
          id,
          yield_quantity,
          yield_unit,
          notes,
          finished_material_id,
          recipe_bom_items(
            id,
            quantity,
            material_id
          )
        `)
        .eq('finished_material_id', materialId)
        .maybeSingle();

      if (bomError) throw bomError;
      
      if (bomData) {
        const itemIds = (bomData.recipe_bom_items || []).map((i: any) => i.material_id).filter(Boolean);
        const allMaterialIds = Array.from(new Set([bomData.finished_material_id, ...itemIds]));

        let materialsMap: Record<string, any> = {};
        if (allMaterialIds.length) {
          const { data: mats, error: matsErr } = await supabase
            .from('materials')
            .select('id,name,code,category,subcategory,usage_unit,material_type')
            .in('id', allMaterialIds);
          if (matsErr) throw matsErr;
          materialsMap = (mats || []).reduce((acc: any, m: any) => { acc[m.id] = m; return acc; }, {});
        }

        const finishedMaterial = materialsMap[bomData.finished_material_id] || {};

        sheets.push({
          id: bomData.id,
          name: finishedMaterial.name || 'Sem nome',
          product_type: finishedMaterial.material_type || 'finished_product',
          category: finishedMaterial.category || '',
          subcategory: finishedMaterial.subcategory,
          material_code: finishedMaterial.code,
          yield_quantity: bomData.yield_quantity,
          yield_unit: bomData.yield_unit,
          notes: bomData.notes,
          items: (bomData.recipe_bom_items || []).map((i: any) => ({
            id: i.id,
            quantity: i.quantity,
            material: materialsMap[i.material_id] || { id: i.material_id, name: 'Material', usage_unit: 'un' }
          }))
        });

        // Carrega recursivamente fichas dos materiais intermediários
        for (const item of bomData.recipe_bom_items || []) {
          const material = materialsMap[item.material_id];
          if (material && material.material_type === 'intermediate_product') {
            const subSheets = await loadTechnicalSheetRecursive(item.material_id, processedIds);
            sheets.push(...subSheets);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ficha técnica recursiva:', error);
    }

    return sheets;
  };

  const loadTechnicalSheets = async (order: ProductionOrder) => {
    const sheets = [];
    const processedIds = new Set<string>();
    
    for (const item of order.items) {
      try {
        const finishedMaterialId = item.bom.finished_material.id;
        const recursiveSheets = await loadTechnicalSheetRecursive(finishedMaterialId, processedIds);
        sheets.push(...recursiveSheets);
      } catch (error) {
        console.error('Erro ao carregar fichas técnicas:', error);
      }
    }
    
    return sheets;
  };

  const confirmPrint = async () => {
    if (!orderToPrint) return;
    
    if (includeTechnicalSheets) {
      toast.loading('Carregando fichas técnicas...');
      const sheets = await loadTechnicalSheets(orderToPrint);
      setTechnicalSheetsData(sheets);
      toast.dismiss();
    }
    
    setShowPrintDialog(false);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planejado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Em Produção':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Concluído':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Cancelado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Planejado':   return 'Planejada';
      case 'Em Produção': return 'Em Produção';
      case 'Concluído':   return 'Concluída';
      case 'Cancelado':   return 'Cancelada';
      default:            return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Planejado':   return <Clock className="h-4 w-4" />;
      case 'Em Produção': return <Play className="h-4 w-4" />;
      case 'Concluído':   return <CheckCircle className="h-4 w-4" />;
      case 'Cancelado':   return <AlertCircle className="h-4 w-4" />;
      default:            return <Clock className="h-4 w-4" />;
    }
  };

  const canTransitionTo = (currentStatus: string, targetStatus: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      'Planejado':   ['Em Produção', 'Cancelado'],
      'Em Produção': ['Concluído', 'Cancelado'],
      'Concluído':   [],
      'Cancelado':   []
    };
    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  };

  // Calcula o custo total da ordem usando os preços médios atuais do estoque
  const calculateOrderCost = (order: ProductionOrder): number => {
    if (!order.consolidated_materials || order.consolidated_materials.length === 0) {
      return order.total_cost || 0;
    }
    
    let totalCost = 0;
    order.consolidated_materials.forEach(cm => {
      // Buscar preço médio atualizado do estoque
      const stockItem = stockItems.find(s => s.material_id === cm.material_id);
      const averagePrice = stockItem?.average_price || 0;
      
      // Se houver preço médio no estoque, usar ele; senão, usar o custo salvo
      if (averagePrice > 0) {
        totalCost += cm.total_quantity * averagePrice;
      } else {
        // Fallback para o custo salvo no material consolidado
        totalCost += cm.total_cost || 0;
      }
    });
    
    return totalCost;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (productionOrders.length === 0) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Package className="h-4 w-4" />
        <AlertDescription>
          Nenhuma ordem de produção BOM encontrada. Crie uma nova ordem usando o botão "Nova Ordem (BOM)" acima.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Ordens de Produção BOM</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie o fluxo de produção com controle de status e estoque
          </p>
        </div>
        <Button onClick={reloadProductionOrders} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="space-y-4">
        {productionOrders.map((order) => (
          <Card key={order.id} className="shadow-elegant">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{order.order_name}</CardTitle>
                    <Badge className={`${getStatusColor(order.status)} font-medium`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </div>
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    Criada em {new Date(order.created_at).toLocaleDateString('pt-BR')} • 
                    Produção para {new Date(order.order_date).toLocaleDateString('pt-BR')}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    R$ {calculateOrderCost(order).toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.items.length} produto(s)
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Timeline de Status */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {order.started_at && (
                  <span>Iniciada: {new Date(order.started_at).toLocaleString('pt-BR')}</span>
                )}
                {order.completed_at && (
                  <span> • Concluída: {new Date(order.completed_at).toLocaleString('pt-BR')}</span>
                )}
                {!order.started_at && !order.completed_at && (
                  <span>Aguardando início da produção</span>
                )}
              </div>

              {/* Produtos da Ordem */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    {expandedOrders.has(order.id) ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    {expandedOrders.has(order.id) ? 'Ocultar' : 'Ver'} Produtos da Ordem
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                      <div>
                        <div className="font-medium">{item.bom.finished_material.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.quantity} × {item.multiplier} = {item.total_yield_quantity} {item.yield_unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">R$ {item.item_cost.toFixed(2)}</div>
                        <Badge variant="outline" className="text-xs">
                          {item.bom.finished_material.code}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Ações */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showMaterialsDetails(order)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Ver Materiais ({order.consolidated_materials.length})
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChecklistOrderId(order.id)}
                  className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Checklist
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => prepareForPrint(order)}
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Ordem
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printThermal(order)}
                  className="bg-slate-50 hover:bg-slate-100 border-slate-200"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir (térmica)
                </Button>

                {canTransitionTo(order.status, 'Em Produção') && (
                  <Button
                    onClick={() => updateOrderStatus(order.id, 'Em Produção')}
                    disabled={processingOrder === order.id}
                    className="bg-yellow-600 hover:bg-yellow-700"
                    size="sm"
                  >
                    {processingOrder === order.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Iniciar Produção
                  </Button>
                )}

                {canTransitionTo(order.status, 'Concluído') && (
                  <Button
                    onClick={() => setFinalizingOrder(order)}
                    disabled={processingOrder === order.id}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Concluir Produção
                  </Button>
                )}

                {canTransitionTo(order.status, 'Cancelado') && (
                  <Button
                    onClick={() => updateOrderStatus(order.id, 'Cancelado')}
                    disabled={processingOrder === order.id}
                    variant="destructive"
                    size="sm"
                  >
                    {processingOrder === order.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mr-2" />
                    )}
                    Cancelar
                  </Button>
                )}
              </div>

              {order.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Opções de Impressão */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opções de Impressão</DialogTitle>
            <DialogDescription>
              Configure como deseja imprimir a ordem de produção
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="includeTechnicalSheets"
                checked={includeTechnicalSheets}
                onChange={(e) => setIncludeTechnicalSheets(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <label htmlFor="includeTechnicalSheets" className="font-medium cursor-pointer">
                  Incluir fichas técnicas dos produtos
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Cada ficha técnica será impressa em sequência após a ordem de produção
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Materiais */}
      <Dialog open={showMaterialsDialog} onOpenChange={setShowMaterialsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Materiais da Ordem: {selectedOrder?.order_name}
            </DialogTitle>
            <DialogDescription>
              Lista consolidada de materiais com status de reserva e consumo
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedOrder.consolidated_materials.map((material) => (
                  <Card key={material.id} className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">{material.material.name}</h4>
                        <p className="text-sm text-muted-foreground">{material.material.category}</p>
                      </div>
                      
                       <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Necessário:</span>
                          <span className="font-semibold">
                            {material.total_quantity.toFixed(2)} {material.unit}
                          </span>
                        </div>
                        
                        {(() => {
                          const stockItem = stockItems.find(s => s.material_id === material.material_id);
                          const currentStock = stockItem?.current_quantity || 0;
                          const hasEnoughStock = currentStock >= material.total_quantity;
                          
                          return (
                            <>
                              <div className="flex justify-between text-sm">
                                <span>Estoque:</span>
                                <span className="font-semibold">
                                  {currentStock.toFixed(2)} {material.unit}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 pt-2">
                                {hasEnoughStock ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-600">Disponível</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-medium text-red-600">
                                      Faltam {(material.total_quantity - currentStock).toFixed(2)} {material.unit}
                                    </span>
                                  </>
                                )}
                              </div>
                            </>
                          );
                        })()}
                        
                        {material.is_reserved && (
                          <div className="flex justify-between text-sm mt-2 pt-2 border-t">
                            <span>Reservado:</span>
                            <span className="font-semibold text-yellow-600">
                              {material.reserved_quantity.toFixed(2)} {material.unit}
                            </span>
                          </div>
                        )}
                        
                        {material.is_consumed && (
                          <div className="flex justify-between text-sm">
                            <span>Consumido:</span>
                            <span className="font-semibold text-green-600">
                              {material.consumed_quantity.toFixed(2)} {material.unit}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1">
                        {material.is_reserved && (
                          <Badge variant="secondary" className="text-xs">
                            Reservado
                          </Badge>
                        )}
                        {material.is_consumed && (
                          <Badge variant="destructive" className="text-xs">
                            Consumido
                          </Badge>
                        )}
                      </div>
                      
                      {material.used_in_boms.length > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Usado em {material.used_in_boms.length} produto(s)
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Componente de Impressão (Oculto) */}
      {orderToPrint && (
        <div style={{ display: 'none' }}>
          <div ref={printRef}>
            <PrintableBOMProductionOrder
              orderName={orderToPrint.order_name}
              orderDate={orderToPrint.order_date}
              orderNumber={`${new Date(orderToPrint.order_date).toLocaleDateString('pt-BR').replace(/\//g, '')}-${orderToPrint.id.slice(0, 8).toUpperCase()}`}
              productionItems={orderToPrint.items.map(item => ({
                bomId: item.bom_id,
                quantity: item.quantity,
                multiplier: item.multiplier
              }))}
              consolidatedIngredients={orderToPrint.consolidated_materials.map(material => ({
                material: {
                  id: material.material.id,
                  name: material.material.name,
                  code: material.material.code || material.material_id,
                  material_type: 'ingredient',
                  category: material.material.category,
                  usage_unit: material.material.usage_unit
                },
                totalQuantity: material.total_quantity,
                totalCost: material.total_cost,
                usedInBOMs: Array.isArray(material.used_in_boms) ? material.used_in_boms : []
              }))}
              boms={orderToPrint.items.map(item => ({
                id: item.bom_id,
                yield_quantity: item.total_yield_quantity / (item.quantity * item.multiplier),
                yield_unit: item.yield_unit,
                finished_material: {
                  id: item.bom.finished_material.id,
                  name: item.bom.finished_material.name,
                  code: item.bom.finished_material.code,
                  material_type: item.bom.finished_material.material_type || 'finished_product',
                  category: item.bom.finished_material.category,
                  usage_unit: 'un'
                }
              }))}
              technicalSheets={technicalSheetsData}
            />
          </div>
        </div>
      )}

      {/* Impressão Térmica (Oculto) */}
      <div style={{ display: 'none' }}>
        <div ref={thermalRef}>
          {thermalOrder && (
            <ThermalPrintableOrder
              kind="producao"
              orderCode={thermalOrder.order_name}
              meta={[
                {
                  label: 'Data',
                  value: new Date(thermalOrder.order_date).toLocaleDateString('pt-BR'),
                },
                { label: 'Status', value: getStatusLabel(thermalOrder.status) },
              ]}
              items={thermalOrder.items.map((item) => ({
                qty: item.quantity.toLocaleString('pt-BR'),
                unit: item.quantity > 1 ? 'lotes' : 'lote',
                name: item.bom.finished_material.name,
                note: item.total_yield_quantity
                  ? `Rende: ${item.total_yield_quantity.toLocaleString('pt-BR')} ${item.yield_unit}`
                  : undefined,
              }))}
              footerNote="Coffeelier - Ordem de Produção"
            />
          )}
        </div>
      </div>

      {/* Dialog de Finalização */}
      {finalizingOrder && (
        <ProductionFinalizationDialog
          order={finalizingOrder}
          open={!!finalizingOrder}
          onClose={() => setFinalizingOrder(null)}
          onFinalized={() => {
            setFinalizingOrder(null);
            reloadProductionOrders();
          }}
        />
      )}

      {/* Dialog Checklist de Produção */}
      {checklistOrderId && (() => {
        const order = productionOrders.find(o => o.id === checklistOrderId);
        if (!order) return null;
        return (
          <Dialog open={!!checklistOrderId} onOpenChange={() => setChecklistOrderId(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <ProductionChecklist
                orderId={order.id}
                orderName={order.order_name}
                orderDate={order.order_date}
                onClose={() => setChecklistOrderId(null)}
              />
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Package, Play, CheckCircle, Clock, AlertCircle, Eye, EyeOff, RefreshCcw, Printer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { PrintableBOMProductionOrder } from './PrintableBOMProductionOrder';

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
    category: string;
    usage_unit: string;
  };
}

export const BOMProductionOrdersList = () => {
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [showMaterialsDialog, setShowMaterialsDialog] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState<ProductionOrder | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [includeTechnicalSheets, setIncludeTechnicalSheets] = useState(false);
  const [technicalSheetsData, setTechnicalSheetsData] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProductionOrders();
  }, []);

  const loadProductionOrders = async () => {
    try {
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
              id, name, category, usage_unit
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProductionOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
      toast.error('Erro ao carregar ordens de produção');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setProcessingOrder(orderId);
    try {
      const { error } = await supabase.rpc('update_production_order_status', {
        p_production_order_id: orderId,
        p_new_status: newStatus
      });

      if (error) throw error;

      await loadProductionOrders();
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
  });

  const prepareForPrint = (order: ProductionOrder) => {
    setOrderToPrint(order);
    setIncludeTechnicalSheets(false);
    setTechnicalSheetsData([]);
    setShowPrintDialog(true);
  };

  const loadTechnicalSheets = async (order: ProductionOrder) => {
    const sheets = [];
    
    for (const item of order.items) {
      try {
        const { data, error } = await supabase
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
          .eq('id', item.bom_id)
          .maybeSingle();

        if (error) throw error;
        if (!data) continue;

        const itemIds = (data.recipe_bom_items || []).map((i: any) => i.material_id).filter(Boolean);
        const allMaterialIds = Array.from(new Set([data.finished_material_id, ...itemIds]));

        let materialsMap: Record<string, any> = {};
        if (allMaterialIds.length) {
          const { data: mats, error: matsErr } = await supabase
            .from('materials')
            .select('id,name,code,category,subcategory,usage_unit')
            .in('id', allMaterialIds);
          if (matsErr) throw matsErr;
          materialsMap = (mats || []).reduce((acc: any, m: any) => { acc[m.id] = m; return acc; }, {});
        }

        const finishedMaterial = materialsMap[data.finished_material_id] || {};

        sheets.push({
          id: data.id,
          name: finishedMaterial.name || 'Sem nome',
          product_type: 'finished_product',
          category: finishedMaterial.category || '',
          subcategory: finishedMaterial.subcategory,
          material_code: finishedMaterial.code,
          yield_quantity: data.yield_quantity,
          yield_unit: data.yield_unit,
          notes: data.notes,
          items: (data.recipe_bom_items || []).map((i: any) => ({
            id: i.id,
            quantity: i.quantity,
            material: materialsMap[i.material_id] || { id: i.material_id, name: 'Material', usage_unit: 'un' }
          }))
        });
      } catch (error) {
        console.error('Erro ao carregar ficha técnica:', error);
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
      case 'planned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planned':
        return 'Planejada';
      case 'in_progress':
        return 'Em Produção';
      case 'completed':
        return 'Concluída';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const canTransitionTo = (currentStatus: string, targetStatus: string): boolean => {
    const validTransitions: Record<string, string[]> = {
      'planned': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };
    return validTransitions[currentStatus]?.includes(targetStatus) || false;
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
        <Button onClick={loadProductionOrders} variant="outline" disabled={loading}>
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
                    R$ {order.total_cost.toFixed(2)}
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
                  onClick={() => prepareForPrint(order)}
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Ordem
                </Button>

                {canTransitionTo(order.status, 'in_progress') && (
                  <Button
                    onClick={() => updateOrderStatus(order.id, 'in_progress')}
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

                {canTransitionTo(order.status, 'completed') && (
                  <Button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    disabled={processingOrder === order.id}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {processingOrder === order.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Concluir Produção
                  </Button>
                )}

                {canTransitionTo(order.status, 'cancelled') && (
                  <Button
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
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
                        <div className="flex justify-between text-sm">
                          <span>Custo:</span>
                          <span className="font-semibold text-primary">
                            R$ {material.total_cost.toFixed(2)}
                          </span>
                        </div>
                        
                        {material.is_reserved && (
                          <div className="flex justify-between text-sm">
                            <span>Reservado:</span>
                            <span className="font-semibold text-yellow-600">
                              {material.reserved_quantity.toFixed(2)} {material.unit}
                            </span>
                          </div>
                        )}
                        
                        {material.is_consumed && (
                          <div className="flex justify-between text-sm">
                            <span>Consumido:</span>
                            <span className="font-semibold text-red-600">
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
              productionItems={orderToPrint.items.map(item => ({
                bomId: item.bom_id,
                quantity: item.quantity,
                multiplier: item.multiplier
              }))}
              consolidatedIngredients={orderToPrint.consolidated_materials.map(material => ({
                material: {
                  id: material.material.id,
                  name: material.material.name,
                  code: material.material_id, // usando como fallback
                  material_type: 'ingredient',
                  category: material.material.category,
                  usage_unit: material.material.usage_unit
                },
                totalQuantity: material.total_quantity,
                totalCost: material.total_cost,
                usedInBOMs: Array.isArray(material.used_in_boms) ? material.used_in_boms : []
              }))}
              totalCost={orderToPrint.total_cost}
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
    </div>
  );
};
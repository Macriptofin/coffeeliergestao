import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, Play, CheckCircle, X, Clock, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface BOMProductionOrder {
  id: string;
  order_name: string;
  order_date: string;
  status: string;
  total_cost: number;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  items: BOMProductionOrderItem[];
  materials: ConsolidatedMaterial[];
}

interface BOMProductionOrderItem {
  id: string;
  bom_id: string;
  quantity: number;
  multiplier: number;
  total_yield_quantity: number;
  yield_unit: string;
  recipes_bom: {
    finished_material: {
      name: string;
      code: string;
      category: string;
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
  material: {
    name: string;
    category: string;
    code: string;
  };
}

export const BOMProductionOrdersList = () => {
  const [orders, setOrders] = useState<BOMProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('bom_production_orders')
        .select(`
          *,
          items:bom_production_order_items (
            *,
            recipes_bom (
              finished_material:materials (
                name,
                code,
                category
              )
            )
          ),
          materials:bom_production_consolidated_materials (
            *,
            material:materials (
              name,
              category,
              code
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
      toast.error('Erro ao carregar ordens de produção');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (processingOrder) return;
    
    setProcessingOrder(orderId);
    try {
      const { error } = await supabase.rpc('update_production_order_status', {
        p_production_order_id: orderId,
        p_new_status: newStatus
      });

      if (error) throw error;

      toast.success(`Status atualizado para: ${getStatusLabel(newStatus)}`);
      await loadOrders();
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
        return 'Planejado';
      case 'in_progress':
        return 'Em Produção';
      case 'completed':
        return 'Concluído';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getStatusActions = (order: BOMProductionOrder) => {
    const actions = [];
    
    if (order.status === 'planned') {
      actions.push(
        <Button
          key="start"
          onClick={() => updateOrderStatus(order.id, 'in_progress')}
          disabled={processingOrder === order.id}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          Iniciar Produção
        </Button>
      );
      actions.push(
        <Button
          key="cancel"
          onClick={() => updateOrderStatus(order.id, 'cancelled')}
          disabled={processingOrder === order.id}
          variant="destructive"
          size="sm"
        >
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      );
    } else if (order.status === 'in_progress') {
      actions.push(
        <Button
          key="complete"
          onClick={() => updateOrderStatus(order.id, 'completed')}
          disabled={processingOrder === order.id}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Finalizar Produção
        </Button>
      );
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Nenhuma ordem de produção encontrada. Crie uma nova ordem usando o botão "Nova Ordem (BOM)" acima.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Ordens de Produção BOM</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie o fluxo completo das suas ordens de produção
          </p>
        </div>
        <Button onClick={loadOrders} variant="outline" disabled={loading}>
          Atualizar
        </Button>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{order.order_name}</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(order.order_date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {order.items.length} produtos
                    </div>
                    {order.started_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Iniciado: {new Date(order.started_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Custo Total:</span>
                  <span className="ml-2 font-semibold text-primary">
                    R$ {order.total_cost?.toFixed(2) || '0,00'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="ml-2">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {order.notes && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}

              {/* Lista de Produtos */}
              <div className="mb-4">
                <h4 className="font-medium mb-2">Produtos a Produzir:</h4>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                      <div>
                        <span className="font-medium">{item.recipes_bom.finished_material.name}</span>
                        <div className="text-sm text-muted-foreground">
                          {item.recipes_bom.finished_material.category} | 
                          Qtd: {item.quantity} | Mult: {item.multiplier}x
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">
                          {item.total_yield_quantity.toLocaleString('pt-BR')} {item.yield_unit}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {item.recipes_bom.finished_material.code}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de Materiais */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-3"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    {expandedOrders.has(order.id) ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    {expandedOrders.has(order.id) ? 'Ocultar' : 'Ver'} Lista de Materiais
                    <span className="ml-2 text-muted-foreground">
                      ({order.materials.length} materiais)
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mb-4">
                  {order.materials.map((material) => (
                    <div key={material.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{material.material.name}</span>
                          {material.is_reserved && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                              Reservado
                            </Badge>
                          )}
                          {material.is_consumed && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                              Consumido
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {material.material.category} | {material.material.code}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {material.total_quantity.toLocaleString('pt-BR')} {material.unit}
                        </div>
                        <div className="text-sm text-primary">
                          R$ {material.total_cost.toFixed(2)}
                        </div>
                        {order.status === 'in_progress' && material.is_reserved && (
                          <div className="text-xs text-muted-foreground">
                            Reservado: {material.reserved_quantity.toLocaleString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Ações de Status */}
              {getStatusActions(order).length > 0 && (
                <div className="flex gap-2 pt-4 border-t">
                  {getStatusActions(order)}
                  {processingOrder === order.id && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Processando...
                    </div>
                  )}
                </div>
              )}

              {order.status === 'completed' && order.completed_at && (
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium pt-4 border-t">
                  <CheckCircle className="h-4 w-4" />
                  Produção Concluída em {new Date(order.completed_at).toLocaleDateString('pt-BR')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
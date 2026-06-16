import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Package, Play, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ProductionOrder {
  id: string;
  order_code: string;
  status: string;
  notes: string | null;
  created_at: string;
  event_table: {
    event_code: string;
    client_name: string;
    attendees: number;
    date_start: string;
  };
  items: ProductionOrderItem[];
}

interface ProductionOrderItem {
  id: string;
  material_id: string;
  planned_qty: number;
  planned_unit: string;
  kind: string;
  material: {
    name: string;
    category: string;
  };
}

export const ProductionOrdersList = () => {
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [executingOrder, setExecutingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadProductionOrders();
  }, []);

  const loadProductionOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('event_production_orders')
        .select(`
          *,
          event_table:event_tables!inner (
            event_code,
            client_name,
            attendees,
            date_start
          ),
          items:event_production_order_items (
            id,
            material_id,
            planned_qty,
            planned_unit,
            kind,
            material:materials (
              name,
              category
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

  const executeManualProduction = async (orderId: string) => {
    setExecutingOrder(orderId);
    try {
      const order = productionOrders.find(o => o.id === orderId);
      if (!order) throw new Error('Ordem não encontrada');

      // Atualizar status da ordem para "Em Produção" primeiro
      const { error: updateError } = await supabase
        .from('event_production_orders')
        .update({ status: 'Em Produção' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Processar cada item da ordem
      for (const item of order.items) {
        if (item.kind === 'produce_finished') {
          // Chamar função de produção
          const { error: prodError } = await supabase.rpc('produce_product', {
            p_material_id: item.material_id,
            p_output_qty: item.planned_qty
          });
          
          if (prodError) {
            console.warn(`Erro ao produzir ${item.material.name}:`, prodError);
            // Continuar com próximo item mesmo se houver erro
          }
        } else if (item.kind === 'pick_resale' || item.kind === 'pick_finished') {
          // Criar movimento de saída
          const { error: moveError } = await supabase.rpc('process_component_consumption', {
            p_material_id: item.material_id,
            p_quantity: item.planned_qty,
            p_unit: item.planned_unit,
            p_movement_type: 'MANUAL_PICK',
            p_reference_material: item.material_id
          });
          
          if (moveError) {
            console.warn(`Erro ao processar saída de ${item.material.name}:`, moveError);
            // Continuar com próximo item mesmo se houver erro
          }
        }
      }

      // Finalizar ordem
      const { error: finalError } = await supabase
        .from('event_production_orders')
        .update({ status: 'Concluído' })
        .eq('id', orderId);

      if (finalError) throw finalError;

      toast.success('Lançamento manual executado com sucesso!');
      await loadProductionOrders();
    } catch (error) {
      console.error('Erro no lançamento manual:', error);
      toast.error('Erro no lançamento manual: ' + (error as Error).message);
    } finally {
      setExecutingOrder(null);
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
      case 'Planejado':   return 'bg-blue-100 text-blue-800';
      case 'Em Produção': return 'bg-yellow-100 text-yellow-800';
      case 'Concluído':   return 'bg-green-100 text-green-800';
      default:            return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Planejado':   return 'Planejado';
      case 'Em Produção': return 'Em Andamento';
      case 'Concluído':   return 'Concluído';
      default:            return status;
    }
  };

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case 'produce_finished':
        return 'Produzir';
      case 'pick_resale':
        return 'Separar (Revenda)';
      case 'pick_finished':
        return 'Separar (Acabado)';
      default:
        return kind;
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'produce_finished':
        return 'bg-purple-100 text-purple-800';
      case 'pick_resale':
        return 'bg-orange-100 text-orange-800';
      case 'pick_finished':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Nenhuma ordem de produção encontrada. Vá para Mesas/Eventos para gerar ordens de produção.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Ordens de Produção</h3>
          <p className="text-sm text-muted-foreground">
            Visualize e execute as ordens de produção geradas
          </p>
        </div>
        <Button onClick={loadProductionOrders} variant="outline" disabled={loading}>
          Atualizar
        </Button>
      </div>

      <div className="space-y-4">
        {productionOrders.map((order) => (
          <Card key={order.id} className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{order.order_code}</CardTitle>
                  <CardDescription>
                    {order.event_table.event_code} - {order.event_table.client_name}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.event_table.attendees} pessoas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(order.event_table.date_start).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {order.notes && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}

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
                    {expandedOrders.has(order.id) ? 'Ocultar' : 'Ver'} Lista de Ingredientes
                    <span className="ml-2 text-muted-foreground">({order.items.length} itens)</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{item.material.name}</span>
                          <Badge variant="outline" className={getKindColor(item.kind)}>
                            {getKindLabel(item.kind)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.material.category}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">
                          {item.planned_qty.toLocaleString('pt-BR')} {item.planned_unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {order.status === 'Planejado' && (
                <Button
                  onClick={() => executeManualProduction(order.id)}
                  disabled={executingOrder === order.id}
                  className="w-full"
                >
                  {executingOrder === order.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Executando Lançamento...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Executar Lançamento Manual
                    </>
                  )}
                </Button>
              )}

              {order.status === 'Concluído' && (
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Lançamento Concluído
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
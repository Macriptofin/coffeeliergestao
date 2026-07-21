import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Check, Send } from "lucide-react";
import { format } from "date-fns";

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  supplier_id: string;
  supplier_name: string;
  expected_delivery_date?: string;
  payment_terms?: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface PurchaseOrderItem {
  id: string;
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

const EMPTY_ORDERS: PurchaseOrder[] = [];
const EMPTY_ITEMS: PurchaseOrderItem[] = [];

async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`*, suppliers ( company_name )`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data?.map((order: any) => ({
    ...order,
    supplier_name: order.suppliers?.company_name || 'N/A'
  })) || []) as PurchaseOrder[];
}

async function fetchOrderItems(orderId: string): Promise<PurchaseOrderItem[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('id, material_id, quantity, unit, unit_price, total_price, materials(name)')
    .eq('purchase_order_id', orderId)
    .order('position');
  if (error) throw error;
  return (data || []).map((i: any) => ({ ...i, material_name: i.materials?.name || '—' }));
}

export function PurchaseOrders() {
  const queryClient = useQueryClient();
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const { data: orders = EMPTY_ORDERS, isPending: loading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: fetchPurchaseOrders,
  });

  const { data: viewingItems = EMPTY_ITEMS, isPending: loadingItems } = useQuery({
    queryKey: ['purchase-order-items', viewingOrderId],
    queryFn: () => fetchOrderItems(viewingOrderId!),
    enabled: !!viewingOrderId,
  });

  const refetchOrders = () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
  const viewingOrder = orders.find(o => o.id === viewingOrderId);

  const advanceStatus = async (order: PurchaseOrder, nextStatus: 'Aprovado' | 'Enviado') => {
    setUpdatingStatus(order.id);
    try {
      const payload: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === 'Aprovado') {
        payload.approved_by = (await supabase.auth.getUser()).data.user?.id;
        payload.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('purchase_orders').update(payload).eq('id', order.id);
      if (error) throw error;
      toast.success(`Pedido ${order.order_number} marcado como ${nextStatus.toLowerCase()}`);
      refetchOrders();
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      toast.error('Erro ao atualizar status do pedido');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aprovado': return 'bg-green-500';
      case 'Enviado': return 'bg-blue-500';
      case 'Recebido': return 'bg-purple-500';
      case 'Cancelado': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Pedidos de Compra</h3>
        <p className="text-sm text-muted-foreground">
          Gerados a partir do fornecedor vencedor de uma cotação, na aba Cotações.
        </p>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Data Pedido</TableHead>
              <TableHead>Previsão Entrega</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono">{order.order_number}</TableCell>
                <TableCell>{order.supplier_name}</TableCell>
                <TableCell>{format(new Date(order.order_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  {order.expected_delivery_date
                    ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy')
                    : '-'}
                </TableCell>
                <TableCell>R$ {order.total_amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewingOrderId(order.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {order.status === 'Pendente' && (
                    <Button size="sm" variant="outline" disabled={updatingStatus === order.id} onClick={() => advanceStatus(order, 'Aprovado')}>
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                  )}
                  {order.status === 'Aprovado' && (
                    <Button size="sm" variant="outline" disabled={updatingStatus === order.id} onClick={() => advanceStatus(order, 'Enviado')}>
                      <Send className="h-4 w-4 mr-1" />
                      Marcar Enviado
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum pedido de compra encontrado. Selecione um fornecedor vencedor numa cotação pra gerar o primeiro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!viewingOrderId} onOpenChange={(open) => !open && setViewingOrderId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Itens do Pedido {viewingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead>Unid.</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.material_name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">R$ {Number(item.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {Number(item.total_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingOrderId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

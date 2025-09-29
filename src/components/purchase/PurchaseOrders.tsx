import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, FileText, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  supplier_id: string;
  supplier_name: string;
  expected_delivery_date?: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data?.map(order => ({
        ...order,
        supplier_name: order.suppliers?.company_name || 'N/A'
      })) || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos de compra",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'sent': return 'bg-blue-500';
      case 'received': return 'bg-purple-500';
      case 'partial': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'sent': return 'Enviado';
      case 'partial': return 'Parcial';
      case 'received': return 'Recebido';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pedidos de Compra</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie pedidos de compra e recebimentos
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número PO</TableHead>
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
                  <Badge className={getStatusColor(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <FileText className="h-4 w-4" />
                  </Button>
                  {order.status === 'sent' && (
                    <Button size="sm" variant="ghost">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum pedido de compra encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
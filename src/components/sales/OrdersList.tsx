import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Package, Truck, CheckCircle, Clock, XCircle, Factory } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SalesOrder {
  id: string;
  order_number: string;
  proposal_id: string | null;
  client_id: string;
  order_date: string;
  event_date: string | null;
  delivery_date: string | null;
  total_amount: number;
  event_category: string | null;
  number_of_people: number | null;
  status: string;
  payment_status: string;
  notes: string | null;
  clients?: {
    name: string;
    client_code: string | null;
  };
  proposals?: {
    proposal_number: string;
  };
}

const statusConfig: Record<string, { label: string; variant: string; icon: React.ReactNode }> = {
  'Pendente': { label: 'Pendente', variant: 'secondary', icon: <Clock size={12} /> },
  'Confirmado': { label: 'Confirmado', variant: 'default', icon: <CheckCircle size={12} /> },
  'Em Produção': { label: 'Em Produção', variant: 'warning', icon: <Factory size={12} /> },
  'Pronto': { label: 'Pronto', variant: 'success', icon: <Package size={12} /> },
  'Entregue': { label: 'Entregue', variant: 'success', icon: <Truck size={12} /> },
  'Cancelado': { label: 'Cancelado', variant: 'destructive', icon: <XCircle size={12} /> },
};

const paymentStatusConfig: Record<string, { label: string; variant: string }> = {
  'Pendente': { label: 'Pendente', variant: 'secondary' },
  'Parcial': { label: 'Parcial', variant: 'warning' },
  'Pago': { label: 'Pago', variant: 'success' },
  'Reembolsado': { label: 'Reembolsado', variant: 'destructive' },
};

interface Props {
  onViewOrder?: (id: string) => void;
}

export default function OrdersList({ onViewOrder }: Props) {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          clients (
            name,
            client_code
          ),
          proposals (
            proposal_number
          )
        `)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setOrders(data as SalesOrder[] || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'Confirmado') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'Entregue') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sales_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Status atualizado com sucesso!');
      loadOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: 'secondary', icon: null };
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    const config = paymentStatusConfig[status] || { label: status, variant: 'secondary' };
    return (
      <Badge variant={config.variant as any}>
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clients?.client_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Métricas
  const pendingOrders = orders.filter(o => o.status === 'Pendente').length;
  const inProductionOrders = orders.filter(o => o.status === 'Em Produção').length;
  const deliveredThisMonth = orders.filter(o => {
    if (o.status !== 'Entregue') return false;
    const orderMonth = new Date(o.order_date).getMonth();
    const currentMonth = new Date().getMonth();
    return orderMonth === currentMonth;
  }).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Carregando pedidos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
              <div className="text-sm text-muted-foreground">Total de Pedidos</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{pendingOrders}</div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Factory className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{inProductionOrders}</div>
              <div className="text-sm text-muted-foreground">Em Produção</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{deliveredThisMonth}</div>
              <div className="text-sm text-muted-foreground">Entregues (mês)</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos de Venda</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.keys(statusConfig).map(status => (
                  <SelectItem key={status} value={status}>
                    {statusConfig[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadOrders}>
              Atualizar
            </Button>
          </div>

          {/* Tabela */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Pedido</TableHead>
                  <TableHead className="min-w-[180px]">Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data Evento</TableHead>
                  <TableHead>Pessoas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.order_number}</div>
                          {order.proposals?.proposal_number && (
                            <div className="text-xs text-muted-foreground">
                              Prop: {order.proposals.proposal_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium whitespace-nowrap">{order.clients?.name}</div>
                          {order.clients?.client_code && (
                            <div className="text-xs text-muted-foreground">
                              {order.clients.client_code}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.event_category ? (
                          <Badge variant="outline">{order.event_category}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {order.event_date 
                          ? new Date(order.event_date).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{order.number_of_people || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {order.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentBadge(order.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {onViewOrder && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewOrder(order.id)}
                                  >
                                    <Eye size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalhes</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {order.status === 'Pendente' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(order.id, 'Confirmado')}
                                  >
                                    <CheckCircle size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Confirmar pedido</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {order.status === 'Confirmado' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(order.id, 'Em Produção')}
                                  >
                                    <Factory size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Iniciar produção</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {order.status === 'Pronto' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleUpdateStatus(order.id, 'Entregue')}
                                  >
                                    <Truck size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Marcar como entregue</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {searchTerm || statusFilter !== 'all'
                        ? 'Nenhum pedido encontrado com os filtros aplicados.'
                        : 'Nenhum pedido cadastrado ainda. Converta uma proposta aprovada em pedido.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  FileText, 
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle
} from 'lucide-react';

interface DashboardData {
  // Revenue metrics
  monthlyRevenue: number;
  previousMonthRevenue: number;
  yearlyRevenue: number;
  
  // Counts
  totalClients: number;
  activeClients: number;
  totalProposals: number;
  pendingProposals: number;
  approvedProposals: number;
  totalOrders: number;
  pendingOrders: number;
  
  // Recent activity
  recentProposals: Array<{
    id: string;
    proposal_number: string;
    client_name: string;
    total_amount: number;
    status: string;
    created_at: string;
  }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    client_name: string;
    total_amount: number;
    status: string;
    event_date: string | null;
  }>;
  
  // Top clients
  topClients: Array<{
    name: string;
    code: string | null;
    totalRevenue: number;
    orderCount: number;
  }>;
}

export default function SalesDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    monthlyRevenue: 0,
    previousMonthRevenue: 0,
    yearlyRevenue: 0,
    totalClients: 0,
    activeClients: 0,
    totalProposals: 0,
    pendingProposals: 0,
    approvedProposals: 0,
    totalOrders: 0,
    pendingOrders: 0,
    recentProposals: [],
    recentOrders: [],
    topClients: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Load all data in parallel
      const [
        clientsRes,
        proposalsRes,
        ordersRes,
        currentMonthOrdersRes,
        previousMonthOrdersRes,
        yearOrdersRes,
        recentProposalsRes,
        recentOrdersRes
      ] = await Promise.all([
        supabase.from('clients').select('id, status'),
        supabase.from('proposals').select('id, status'),
        supabase.from('sales_orders').select('id, status, client_id, total_amount'),
        supabase.from('sales_orders')
          .select('total_amount')
          .gte('order_date', currentMonthStart)
          .not('status', 'eq', 'Cancelado'),
        supabase.from('sales_orders')
          .select('total_amount')
          .gte('order_date', previousMonthStart)
          .lte('order_date', previousMonthEnd)
          .not('status', 'eq', 'Cancelado'),
        supabase.from('sales_orders')
          .select('total_amount')
          .gte('order_date', yearStart)
          .not('status', 'eq', 'Cancelado'),
        supabase.from('proposals')
          .select(`*, clients(name)`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('sales_orders')
          .select(`*, clients(name, client_code)`)
          .order('order_date', { ascending: false })
          .limit(5)
      ]);

      // Calculate metrics
      const clients = clientsRes.data || [];
      const proposals = proposalsRes.data || [];
      const orders = ordersRes.data || [];

      const monthlyRevenue = (currentMonthOrdersRes.data || [])
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const previousMonthRevenue = (previousMonthOrdersRes.data || [])
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const yearlyRevenue = (yearOrdersRes.data || [])
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      // Top clients from orders
      const clientRevenue = new Map<string, { name: string; code: string | null; revenue: number; count: number }>();
      for (const order of orders) {
        const clientId = order.client_id;
        const existing = clientRevenue.get(clientId) || { name: '', code: null, revenue: 0, count: 0 };
        existing.revenue += order.total_amount || 0;
        existing.count += 1;
        clientRevenue.set(clientId, existing);
      }

      // Fetch client names for top clients
      const topClientIds = Array.from(clientRevenue.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([id]) => id);

      if (topClientIds.length > 0) {
        const { data: clientNames } = await supabase
          .from('clients')
          .select('id, name, client_code')
          .in('id', topClientIds);
        
        clientNames?.forEach(client => {
          const existing = clientRevenue.get(client.id);
          if (existing) {
            existing.name = client.name;
            existing.code = client.client_code;
          }
        });
      }

      const topClients = Array.from(clientRevenue.values())
        .filter(c => c.name)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(c => ({
          name: c.name,
          code: c.code,
          totalRevenue: c.revenue,
          orderCount: c.count
        }));

      setData({
        monthlyRevenue,
        previousMonthRevenue,
        yearlyRevenue,
        totalClients: clients.length,
        activeClients: clients.filter(c => c.status === 'Ativo').length,
        totalProposals: proposals.length,
        pendingProposals: proposals.filter(p => p.status === 'Rascunho' || p.status === 'Enviada').length,
        approvedProposals: proposals.filter(p => p.status === 'Aprovada').length,
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'Pendente' || o.status === 'Confirmado').length,
        recentProposals: (recentProposalsRes.data || []).map((p: any) => ({
          id: p.id,
          proposal_number: p.proposal_number,
          client_name: p.clients?.name || 'N/A',
          total_amount: p.total_amount,
          status: p.status,
          created_at: p.created_at
        })),
        recentOrders: (recentOrdersRes.data || []).map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          client_name: o.clients?.name || 'N/A',
          total_amount: o.total_amount,
          status: o.status,
          event_date: o.event_date
        })),
        topClients
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getGrowthPercentage = () => {
    if (data.previousMonthRevenue === 0) return null;
    return ((data.monthlyRevenue - data.previousMonthRevenue) / data.previousMonthRevenue) * 100;
  };

  const growth = getGrowthPercentage();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'Rascunho': 'secondary',
      'Enviada': 'default',
      'Aprovada': 'success',
      'Pendente': 'secondary',
      'Confirmado': 'default',
      'Em Produção': 'warning',
      'Entregue': 'success'
    };
    return <Badge variant={variants[status] as any || 'secondary'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              Receita do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(data.monthlyRevenue)}
            </div>
            {growth !== null && (
              <p className={`text-sm flex items-center gap-1 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(growth).toFixed(1)}% vs mês anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              Receita Anual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(data.yearlyRevenue)}
            </div>
            <p className="text-sm text-muted-foreground">
              {data.totalOrders} pedidos no ano
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
              Propostas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data.pendingProposals}
            </div>
            <p className="text-sm text-muted-foreground">
              {data.approvedProposals} aprovadas • {data.totalProposals} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-green-600" />
              </div>
              Pedidos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.pendingOrders}
            </div>
            <p className="text-sm text-muted-foreground">
              Aguardando produção/entrega
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Proposals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Propostas Recentes
            </CardTitle>
            <CardDescription>Últimas 5 propostas criadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentProposals.length > 0 ? (
                data.recentProposals.map(proposal => (
                  <div key={proposal.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{proposal.proposal_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {proposal.client_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium">
                        {formatCurrency(proposal.total_amount)}
                      </span>
                      {getStatusBadge(proposal.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhuma proposta criada ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedidos Recentes
            </CardTitle>
            <CardDescription>Últimos 5 pedidos de venda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentOrders.length > 0 ? (
                data.recentOrders.map(order => (
                  <div key={order.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {order.client_name}
                        {order.event_date && ` • ${new Date(order.event_date).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium">
                        {formatCurrency(order.total_amount)}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhum pedido criado ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Clientes
          </CardTitle>
          <CardDescription>Clientes com maior faturamento</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topClients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {data.topClients.map((client, index) => (
                <div key={index} className="p-4 bg-accent rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    #{index + 1}
                  </div>
                  <p className="font-medium truncate" title={client.name}>
                    {client.name}
                  </p>
                  {client.code && (
                    <Badge variant="outline" className="mt-1">{client.code}</Badge>
                  )}
                  <p className="text-lg font-bold text-primary mt-2">
                    {formatCurrency(client.totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {client.orderCount} pedido{client.orderCount !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>Nenhum pedido registrado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

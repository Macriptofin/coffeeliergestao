import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  Building2,
  FileText,
  Download
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReportData {
  clients: Array<{
    id: string;
    name: string;
    client_code: string | null;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
  }>;
  departments: Array<{
    name: string;
    clientName: string;
    totalOrders: number;
    totalRevenue: number;
  }>;
  categories: Array<{
    category: string;
    totalOrders: number;
    totalRevenue: number;
    totalPeople: number;
  }>;
  monthly: Array<{
    month: string;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
  }>;
}

export default function SalesReports() {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'clients' | 'departments' | 'categories' | 'monthly'>('clients');
  const [period, setPeriod] = useState('all');
  const [reportData, setReportData] = useState<ReportData>({
    clients: [],
    departments: [],
    categories: [],
    monthly: []
  });

  useEffect(() => {
    loadReportData();
  }, [period]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Build date filter
      let dateFilter = '';
      const now = new Date();
      if (period === 'month') {
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (period === 'quarter') {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = quarterStart.toISOString();
      } else if (period === 'year') {
        dateFilter = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      // Load orders with relationships
      let query = supabase
        .from('sales_orders')
        .select(`
          *,
          clients (
            id,
            name,
            client_code
          ),
          client_departments (
            name
          )
        `)
        .not('status', 'eq', 'Cancelado');

      if (dateFilter) {
        query = query.gte('order_date', dateFilter);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Process data for different report types
      const clientsMap = new Map<string, { name: string; code: string | null; orders: number; revenue: number }>();
      const departmentsMap = new Map<string, { clientName: string; orders: number; revenue: number }>();
      const categoriesMap = new Map<string, { orders: number; revenue: number; people: number }>();
      const monthlyMap = new Map<string, { orders: number; revenue: number }>();

      orders?.forEach(order => {
        // Clients
        if (order.clients) {
          const existing = clientsMap.get(order.client_id) || { 
            name: order.clients.name, 
            code: order.clients.client_code,
            orders: 0, 
            revenue: 0 
          };
          existing.orders += 1;
          existing.revenue += order.total_amount || 0;
          clientsMap.set(order.client_id, existing);
        }

        // Departments
        if (order.client_departments) {
          const deptKey = `${order.client_id}-${order.department_id}`;
          const existing = departmentsMap.get(deptKey) || { 
            clientName: order.clients?.name || 'N/A',
            orders: 0, 
            revenue: 0 
          };
          existing.orders += 1;
          existing.revenue += order.total_amount || 0;
          departmentsMap.set(deptKey, existing);
        }

        // Categories
        if (order.event_category) {
          const existing = categoriesMap.get(order.event_category) || { 
            orders: 0, 
            revenue: 0,
            people: 0
          };
          existing.orders += 1;
          existing.revenue += order.total_amount || 0;
          existing.people += order.number_of_people || 0;
          categoriesMap.set(order.event_category, existing);
        }

        // Monthly
        const monthKey = new Date(order.order_date).toISOString().slice(0, 7);
        const existingMonth = monthlyMap.get(monthKey) || { orders: 0, revenue: 0 };
        existingMonth.orders += 1;
        existingMonth.revenue += order.total_amount || 0;
        monthlyMap.set(monthKey, existingMonth);
      });

      // Convert maps to arrays
      const clientsReport = Array.from(clientsMap.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          client_code: data.code,
          totalOrders: data.orders,
          totalRevenue: data.revenue,
          averageTicket: data.orders > 0 ? data.revenue / data.orders : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      const departmentsReport = Array.from(departmentsMap.entries())
        .map(([key, data]) => ({
          name: key.split('-')[1] || 'Sem departamento',
          clientName: data.clientName,
          totalOrders: data.orders,
          totalRevenue: data.revenue
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      const categoriesReport = Array.from(categoriesMap.entries())
        .map(([category, data]) => ({
          category,
          totalOrders: data.orders,
          totalRevenue: data.revenue,
          totalPeople: data.people
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      const monthlyReport = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          totalOrders: data.orders,
          totalRevenue: data.revenue,
          averageTicket: data.orders > 0 ? data.revenue / data.orders : 0
        }))
        .sort((a, b) => b.month.localeCompare(a.month));

      setReportData({
        clients: clientsReport,
        departments: departmentsReport,
        categories: categoriesReport,
        monthly: monthlyReport
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
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

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Totals
  const totalRevenue = reportData.clients.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalOrders = reportData.clients.reduce((sum, c) => sum + c.totalOrders, 0);
  const uniqueClients = reportData.clients.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Carregando relatórios...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="text-sm text-muted-foreground">Faturamento Total</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalOrders}</div>
              <div className="text-sm text-muted-foreground">Pedidos</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{uniqueClients}</div>
              <div className="text-sm text-muted-foreground">Clientes Atendidos</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : 'R$ 0'}
              </div>
              <div className="text-sm text-muted-foreground">Ticket Médio</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Report Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Relatórios de Vendas
              </CardTitle>
              <CardDescription>Análise detalhada por diferentes dimensões</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="quarter">Este trimestre</SelectItem>
                  <SelectItem value="year">Este ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Report Type Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button 
              variant={reportType === 'clients' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('clients')}
            >
              <Users className="h-4 w-4 mr-2" />
              Por Cliente
            </Button>
            <Button 
              variant={reportType === 'departments' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('departments')}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Por Departamento
            </Button>
            <Button 
              variant={reportType === 'categories' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('categories')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Por Categoria
            </Button>
            <Button 
              variant={reportType === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportType('monthly')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Por Mês
            </Button>
          </div>

          {/* Report Tables */}
          <div className="rounded-md border">
            {reportType === 'clients' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.clients.length > 0 ? (
                    reportData.clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Badge variant="outline">{client.client_code || '-'}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-right">{client.totalOrders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(client.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(client.averageTicket)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === 'categories' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria de Evento</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Pessoas Atendidas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Média p/ Pessoa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.categories.length > 0 ? (
                    reportData.categories.map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell>
                          <Badge variant="outline">{cat.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{cat.totalOrders}</TableCell>
                        <TableCell className="text-right">{cat.totalPeople}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(cat.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {cat.totalPeople > 0 
                            ? formatCurrency(cat.totalRevenue / cat.totalPeople)
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === 'monthly' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.monthly.length > 0 ? (
                    reportData.monthly.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium capitalize">
                          {formatMonth(month.month)}
                        </TableCell>
                        <TableCell className="text-right">{month.totalOrders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(month.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(month.averageTicket)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado para o período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {reportType === 'departments' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.departments.length > 0 ? (
                    reportData.departments.map((dept, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{dept.clientName}</TableCell>
                        <TableCell>{dept.name}</TableCell>
                        <TableCell className="text-right">{dept.totalOrders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(dept.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado. Os pedidos precisam estar vinculados a departamentos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

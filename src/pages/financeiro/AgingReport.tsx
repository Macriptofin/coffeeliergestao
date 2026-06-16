import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CalendarDays, TrendingDown, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";

interface AccountItem {
  id: string;
  description: string;
  due_date: string;
  original_amount: number;
  remaining_amount: number;
  status: string;
  supplier_name?: string;
  client_name?: string;
}

interface AgingBucket {
  label: string;
  range: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
}

interface AgingData {
  payables: AccountItem[];
  receivables: AccountItem[];
}

const COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

const EMPTY_AGING: AgingData = { payables: [], receivables: [] };

async function fetchAgingData(): Promise<AgingData> {
  const [payablesRes, receivablesRes] = await Promise.all([
    supabase
      .from('accounts_payable')
      .select(`*, suppliers(company_name)`)
      .eq('status', 'Pendente')
      .order('due_date'),
    supabase
      .from('accounts_receivable')
      .select(`*, clients(name)`)
      .eq('status', 'Pendente')
      .order('due_date')
  ]);

  if (payablesRes.error) throw payablesRes.error;
  if (receivablesRes.error) throw receivablesRes.error;

  const payables = (payablesRes.data || []).map(p => ({
    ...p,
    supplier_name: p.suppliers?.company_name
  }));

  const receivables = (receivablesRes.data || []).map(r => ({
    ...r,
    client_name: r.clients?.name
  }));

  return { payables, receivables };
}

const calculateBuckets = (items: AccountItem[]): AgingBucket[] => {
    const today = new Date();
    const buckets = [
      { label: 'A Vencer', range: '> 0 dias', min: 1, max: Infinity, count: 0, total: 0, color: COLORS[0] },
      { label: '1-30 dias', range: '1-30 dias', min: -30, max: 0, count: 0, total: 0, color: COLORS[1] },
      { label: '31-60 dias', range: '31-60 dias', min: -60, max: -31, count: 0, total: 0, color: COLORS[2] },
      { label: '61-90 dias', range: '61-90 dias', min: -90, max: -61, count: 0, total: 0, color: COLORS[3] },
      { label: '> 90 dias', range: '> 90 dias', min: -Infinity, max: -91, count: 0, total: 0, color: COLORS[4] },
    ];

    const total = items.reduce((sum, item) => sum + item.remaining_amount, 0);

    items.forEach(item => {
      const daysUntilDue = differenceInDays(new Date(item.due_date), today);
      
      for (const bucket of buckets) {
        if (daysUntilDue >= bucket.min && daysUntilDue <= bucket.max) {
          bucket.count++;
          bucket.total += item.remaining_amount;
          break;
        }
      }
    });

    return buckets.map(b => ({
      ...b,
      percentage: total > 0 ? (b.total / total) * 100 : 0
    }));
  };

const AgingReport = () => {
  const {
    data = EMPTY_AGING,
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: ['aging'],
    queryFn: fetchAgingData,
  });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar aging de contas');
  }, [isError]);

  const { payables, receivables } = data;

  const payablesBuckets = useMemo(() => calculateBuckets(payables), [payables]);
  const receivablesBuckets = useMemo(() => calculateBuckets(receivables), [receivables]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getDaysOverdue = (dueDate: string) => {
    const days = differenceInDays(new Date(), new Date(dueDate));
    return days;
  };

  const getOverdueBadge = (dueDate: string) => {
    const days = getDaysOverdue(dueDate);
    if (days < 0) return <Badge variant="default">A vencer em {Math.abs(days)}d</Badge>;
    if (days === 0) return <Badge variant="outline">Vence hoje</Badge>;
    if (days <= 30) return <Badge variant="secondary">Vencido há {days}d</Badge>;
    if (days <= 60) return <Badge className="bg-orange-500">Vencido há {days}d</Badge>;
    return <Badge variant="destructive">Vencido há {days}d</Badge>;
  };

  const totalPayables = payables.reduce((sum, p) => sum + p.remaining_amount, 0);
  const totalReceivables = receivables.reduce((sum, r) => sum + r.remaining_amount, 0);
  const overduePayables = payables.filter(p => getDaysOverdue(p.due_date) > 0);
  const overdueReceivables = receivables.filter(r => getDaysOverdue(r.due_date) > 0);

  const renderBucketsChart = (buckets: AgingBucket[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Faixa: ${label}`}
            />
            <Bar dataKey="total" fill="hsl(var(--primary))">
              {buckets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={buckets.filter(b => b.total > 0)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="total"
              nameKey="label"
            >
              {buckets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderBucketsTable = (buckets: AgingBucket[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Faixa de Vencimento</TableHead>
          <TableHead className="text-center">Quantidade</TableHead>
          <TableHead className="text-right">Valor Total</TableHead>
          <TableHead>% do Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map((bucket) => (
          <TableRow key={bucket.label}>
            <TableCell>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: bucket.color }}
                />
                {bucket.label}
              </div>
            </TableCell>
            <TableCell className="text-center">{bucket.count}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(bucket.total)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Progress value={bucket.percentage} className="h-2 w-20" />
                <span className="text-sm text-muted-foreground">
                  {bucket.percentage.toFixed(1)}%
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderDetailTable = (items: AccountItem[], type: 'payable' | 'receivable') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type === 'payable' ? 'Fornecedor' : 'Cliente'}</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 20).map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">
              {type === 'payable' ? item.supplier_name || '-' : item.client_name || '-'}
            </TableCell>
            <TableCell>{item.description}</TableCell>
            <TableCell>{format(new Date(item.due_date), 'dd/MM/yyyy')}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.remaining_amount)}</TableCell>
            <TableCell>{getOverdueBadge(item.due_date)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Aging de Contas</h1>
        <p className="text-muted-foreground">Análise de vencimentos por faixa de tempo</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPayables)}</div>
            <p className="text-xs text-muted-foreground">{payables.length} contas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivables)}</div>
            <p className="text-xs text-muted-foreground">{receivables.length} recebimentos pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Atrasados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(overduePayables.reduce((sum, p) => sum + p.remaining_amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">{overduePayables.length} contas vencidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebimentos Atrasados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(overdueReceivables.reduce((sum, r) => sum + r.remaining_amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">{overdueReceivables.length} recebimentos vencidos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payables">
            <TrendingDown className="h-4 w-4 mr-2" />
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="receivables">
            <TrendingUp className="h-4 w-4 mr-2" />
            Contas a Receber
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Distribuição por Vencimento - Contas a Pagar
              </CardTitle>
              <CardDescription>Análise do aging de contas a pagar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBucketsChart(payablesBuckets)}
              {renderBucketsTable(payablesBuckets)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento - Contas a Pagar</CardTitle>
              <CardDescription>Lista das contas ordenadas por vencimento</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDetailTable(payables, 'payable')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Distribuição por Vencimento - Contas a Receber
              </CardTitle>
              <CardDescription>Análise do aging de contas a receber</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderBucketsChart(receivablesBuckets)}
              {renderBucketsTable(receivablesBuckets)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento - Contas a Receber</CardTitle>
              <CardDescription>Lista dos recebimentos ordenados por vencimento</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDetailTable(receivables, 'receivable')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgingReport;
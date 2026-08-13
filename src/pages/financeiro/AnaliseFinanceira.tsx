import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3, Calendar, Shield } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface FinancialData {
  entradas: number;
  saidas: number;
  saldo: number;
  periodo: string;
}

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface CostCenterData {
  name: string;
  amount: number;
  percentage: number;
}

interface CashTransaction {
  transaction_date: string;
  transaction_type: string;
  category: string;
  amount: number;
  cost_centers: { name: string } | null;
}

const EMPTY_TRANSACTIONS: CashTransaction[] = [];

async function fetchCashTransactions(start: string, end: string): Promise<CashTransaction[]> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select(`
      transaction_date,
      transaction_type,
      category,
      amount,
      cost_centers(name)
    `)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date');

  if (error) throw error;
  return (data as unknown as CashTransaction[]) || [];
}

function processMonthlyData(transactions: any[]): FinancialData[] {
  const monthlyMap = new Map<string, { entradas: number; saidas: number }>();

  transactions.forEach(transaction => {
    const monthKey = format(new Date(transaction.transaction_date), 'yyyy-MM');

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { entradas: 0, saidas: 0 });
    }

    const monthData = monthlyMap.get(monthKey)!;

    if (transaction.transaction_type === 'Entrada') {
      monthData.entradas += transaction.amount;
    } else {
      monthData.saidas += transaction.amount;
    }
  });

  return Array.from(monthlyMap.entries()).map(([monthKey, data]) => ({
    periodo: format(new Date(monthKey + '-01'), 'MMM/yyyy', { locale: ptBR }),
    entradas: data.entradas,
    saidas: data.saidas,
    saldo: data.entradas - data.saidas
  })).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

function processCategoryData(transactions: any[]): CategoryData[] {
  const categoryMap = new Map<string, number>();
  let totalExpenses = 0;

  transactions
    .filter(t => t.transaction_type === 'Saída')
    .forEach(transaction => {
      const current = categoryMap.get(transaction.category) || 0;
      categoryMap.set(transaction.category, current + transaction.amount);
      totalExpenses += transaction.amount;
    });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10); // Top 10 categorias
}

function processCostCenterData(transactions: any[]): CostCenterData[] {
  const costCenterMap = new Map<string, number>();
  let totalExpenses = 0;

  transactions
    .filter(t => t.transaction_type === 'Saída' && t.cost_centers?.name)
    .forEach(transaction => {
      const centerName = transaction.cost_centers.name;
      const current = costCenterMap.get(centerName) || 0;
      costCenterMap.set(centerName, current + transaction.amount);
      totalExpenses += transaction.amount;
    });

  return Array.from(costCenterMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function calculateTotalMetrics(transactions: any[]) {
  const totalEntradas = transactions
    .filter(t => t.transaction_type === 'Entrada')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaidas = transactions
    .filter(t => t.transaction_type === 'Saída')
    .reduce((sum, t) => sum + t.amount, 0);

  const saldoLiquido = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? (saldoLiquido / totalEntradas) * 100 : 0;

  return {
    totalEntradas,
    totalSaidas,
    saldoLiquido,
    margem
  };
}

const AnaliseFinanceira = () => {
  const { can, loading: permissionsLoading } = useUserRole();
  const hasFinancialAccess = can('financeiro', 'view');
  const [period, setPeriod] = useState("3"); // Últimos 3 meses
  const [dateFilter, setDateFilter] = useState({
    start: format(subMonths(startOfMonth(new Date()), 2), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const {
    data: cashTransactions = EMPTY_TRANSACTIONS,
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: ['analise-financeira', dateFilter.start, dateFilter.end],
    queryFn: () => fetchCashTransactions(dateFilter.start, dateFilter.end),
  });
  const showLoader = useDelayedLoading(loading);

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar dados financeiros');
  }, [isError]);

  useEffect(() => {
    const months = parseInt(period);
    const startDate = startOfMonth(subMonths(new Date(), months - 1));
    const endDate = endOfMonth(new Date());

    setDateFilter({
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd')
    });
  }, [period]);

  const financialEvolution = useMemo(() => processMonthlyData(cashTransactions), [cashTransactions]);
  const expensesByCategory = useMemo(() => processCategoryData(cashTransactions), [cashTransactions]);
  const expensesByCostCenter = useMemo(() => processCostCenterData(cashTransactions), [cashTransactions]);
  const totalMetrics = useMemo(() => calculateTotalMetrics(cashTransactions), [cashTransactions]);

  const chartConfig = {
    entradas: {
      label: "Entradas",
      color: "hsl(var(--chart-1))",
    },
    saidas: {
      label: "Saídas", 
      color: "hsl(var(--chart-2))",
    },
    saldo: {
      label: "Saldo",
      color: "hsl(var(--chart-3))",
    },
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (permissionsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!hasFinancialAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar as análises financeiras. Entre em contato com um administrador para solicitar acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showLoader) {
    return <div className="p-6">Carregando análises...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Análises Financeiras</h1>
        <p className="text-muted-foreground">
          Indicadores, gráficos e análises de performance financeira
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="period">Período de Análise</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <div>
            <Label htmlFor="start_date">Data Inicial</Label>
            <Input
              id="start_date"
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="end_date">Data Final</Label>
            <Input
              id="end_date"
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas Totais</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalMetrics.totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalMetrics.totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado Líquido</CardTitle>
            <DollarSign className={`h-4 w-4 ${totalMetrics.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalMetrics.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalMetrics.saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Líquida</CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalMetrics.margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalMetrics.margem.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Evolução Financeira */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolução Financeira Mensal
            </CardTitle>
            <CardDescription>
              Comparativo de entradas, saídas e saldo por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px]">
              <BarChart data={financialEvolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="entradas" fill="var(--color-entradas)" />
                <Bar dataKey="saidas" fill="var(--color-saidas)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Linha de Saldo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução do Saldo
            </CardTitle>
            <CardDescription>
              Tendência do saldo líquido ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px]">
              <LineChart data={financialEvolution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="var(--color-saldo)" 
                  strokeWidth={3}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Despesas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Despesas por Categoria
            </CardTitle>
            <CardDescription>
              Distribuição das despesas por categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="amount"
                    label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                  >
                    {expensesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded p-3 shadow">
                            <p className="font-medium">{data.category}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {data.percentage.toFixed(1)}% do total
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Despesas por Centro de Custo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Despesas por Centro de Custo
            </CardTitle>
            <CardDescription>
              Custos distribuídos por centro de responsabilidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer 
              config={{
                amount: {
                  label: "Valor",
                  color: "hsl(var(--chart-1))",
                },
              }} 
              className="h-[400px]"
            >
              <BarChart data={expensesByCostCenter} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded p-3 shadow">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data.percentage.toFixed(1)}% do total
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" fill="var(--color-amount)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnaliseFinanceira;
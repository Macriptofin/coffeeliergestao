import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ForecastItem {
  date: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

interface PayableReceivable {
  id: string;
  description: string;
  due_date: string;
  remaining_amount: number;
  type: 'entrada' | 'saida';
}

const CashFlowForecast = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [horizon, setHorizon] = useState<'30' | '60' | '90'>('30');
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  const [items, setItems] = useState<PayableReceivable[]>([]);

  useEffect(() => {
    fetchData();
  }, [period, horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const endDate = addDays(new Date(), parseInt(horizon));
      const today = new Date();

      // Buscar saldo inicial das contas bancárias
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('is_active', true);

      const totalBalance = (bankData || []).reduce((sum, b) => sum + b.current_balance, 0);
      setInitialBalance(totalBalance);

      // Buscar contas a pagar pendentes
      const { data: payables } = await supabase
        .from('accounts_payable')
        .select('id, description, due_date, remaining_amount')
        .eq('status', 'Pendente')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .lte('due_date', format(endDate, 'yyyy-MM-dd'));

      // Buscar contas a receber pendentes
      const { data: receivables } = await supabase
        .from('accounts_receivable')
        .select('id, description, due_date, remaining_amount')
        .eq('status', 'Pendente')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .lte('due_date', format(endDate, 'yyyy-MM-dd'));

      // Buscar transações recorrentes
      const { data: recurring } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('is_active', true)
        .lte('next_execution', format(endDate, 'yyyy-MM-dd'));

      const allItems: PayableReceivable[] = [
        ...(payables || []).map(p => ({ ...p, type: 'saida' as const })),
        ...(receivables || []).map(r => ({ ...r, type: 'entrada' as const }))
      ];

      // Adicionar transações recorrentes projetadas
      (recurring || []).forEach(r => {
        let nextDate = new Date(r.next_execution);
        while (nextDate <= endDate) {
          allItems.push({
            id: `${r.id}-${format(nextDate, 'yyyy-MM-dd')}`,
            description: `[Recorrente] ${r.description}`,
            due_date: format(nextDate, 'yyyy-MM-dd'),
            remaining_amount: r.amount,
            type: r.transaction_type === 'Entrada' ? 'entrada' : 'saida'
          });

          // Calcular próxima data
          switch (r.frequency) {
            case 'daily':
              nextDate = addDays(nextDate, 1);
              break;
            case 'weekly':
              nextDate = addWeeks(nextDate, 1);
              break;
            case 'monthly':
              nextDate = addMonths(nextDate, 1);
              break;
            default:
              nextDate = addMonths(nextDate, 1);
          }
        }
      });

      setItems(allItems);

      // Gerar períodos de previsão
      const forecast = generateForecast(allItems, totalBalance, today, endDate, period);
      setForecastData(forecast);

    } catch (error) {
      console.error('Error fetching forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = (
    items: PayableReceivable[], 
    initialBalance: number, 
    start: Date, 
    end: Date,
    periodType: 'weekly' | 'monthly'
  ): ForecastItem[] => {
    let periods: { start: Date; end: Date; label: string }[];

    if (periodType === 'weekly') {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
      periods = weeks.map(weekStart => ({
        start: weekStart,
        end: endOfWeek(weekStart, { weekStartsOn: 0 }),
        label: `Sem ${format(weekStart, 'dd/MM')}`
      }));
    } else {
      const months = eachMonthOfInterval({ start, end });
      periods = months.map(monthStart => ({
        start: monthStart,
        end: endOfMonth(monthStart),
        label: format(monthStart, 'MMM/yy', { locale: ptBR })
      }));
    }

    let saldoAcumulado = initialBalance;
    
    return periods.map(period => {
      const periodItems = items.filter(item => {
        const itemDate = new Date(item.due_date);
        return itemDate >= period.start && itemDate <= period.end;
      });

      const entradas = periodItems
        .filter(i => i.type === 'entrada')
        .reduce((sum, i) => sum + i.remaining_amount, 0);

      const saidas = periodItems
        .filter(i => i.type === 'saida')
        .reduce((sum, i) => sum + i.remaining_amount, 0);

      const saldo = entradas - saidas;
      saldoAcumulado += saldo;

      return {
        date: format(period.start, 'yyyy-MM-dd'),
        label: period.label,
        entradas,
        saidas,
        saldo,
        saldoAcumulado
      };
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalEntradas = forecastData.reduce((sum, f) => sum + f.entradas, 0);
  const totalSaidas = forecastData.reduce((sum, f) => sum + f.saidas, 0);
  const saldoFinal = forecastData.length > 0 ? forecastData[forecastData.length - 1].saldoAcumulado : initialBalance;
  const minBalance = Math.min(...forecastData.map(f => f.saldoAcumulado), initialBalance);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Previsão de Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Projeção baseada em contas a pagar, receber e recorrências</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: 'weekly' | 'monthly') => setPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={horizon} onValueChange={(v: '30' | '60' | '90') => setHorizon(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${initialBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(initialBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Em contas bancárias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas Previstas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEntradas)}</div>
            <p className="text-xs text-muted-foreground">Próximos {horizon} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas Previstas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSaidas)}</div>
            <p className="text-xs text-muted-foreground">Próximos {horizon} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(saldoFinal)}
            </div>
            <p className="text-xs text-muted-foreground">Ao final do período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Mínimo</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${minBalance < 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${minBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(minBalance)}
            </div>
            {minBalance < 0 && (
              <p className="text-xs text-red-500">Atenção: saldo negativo previsto</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do Saldo</CardTitle>
          <CardDescription>Projeção do saldo acumulado ao longo do período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                <Area 
                  type="monotone" 
                  dataKey="saldoAcumulado" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  name="Saldo Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Entradas x Saídas */}
      <Card>
        <CardHeader>
          <CardTitle>Entradas vs Saídas por Período</CardTitle>
          <CardDescription>Comparativo de movimentações previstas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line 
                  type="monotone" 
                  dataKey="entradas" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Entradas"
                />
                <Line 
                  type="monotone" 
                  dataKey="saidas" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Saídas"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Período</CardTitle>
          <CardDescription>Movimentações previstas agregadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo do Período</TableHead>
                <TableHead className="text-right">Saldo Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">Saldo Inicial</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className={`text-right font-bold ${initialBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(initialBalance)}
                </TableCell>
              </TableRow>
              {forecastData.map((item) => (
                <TableRow key={item.date}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {item.entradas > 0 ? formatCurrency(item.entradas) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {item.saidas > 0 ? formatCurrency(item.saidas) : '-'}
                  </TableCell>
                  <TableCell className={`text-right ${item.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.saldo)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.saldoAcumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.saldoAcumulado)}
                    {item.saldoAcumulado < 0 && (
                      <Badge variant="destructive" className="ml-2">Negativo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlowForecast;
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { FileText, Download, Calculator, TrendingUp, DollarSign, ChevronRight, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
  level: number;
}

interface DRELine {
  code: string;
  label: string;
  value: number;
  level: number;
  isCalculated?: boolean;
  isPositive?: boolean;
  children?: DRELine[];
}

interface CashFlowStatement {
  category: string;
  description: string;
  amount: number;
  type: 'operational' | 'investment' | 'financing';
}

// ─── Tipos de fontes de dados ──────────────────────────────────────────────────

interface AccountRow {
  id: string;
  code: string;
  name: string;
  account_type: string;
  level: number;
  parent_id: string | null;
}

interface DRESources {
  accounts: AccountRow[];
  receivables: { account_id: string | null; original_amount: number | null; discount_amount: number | null; interest_amount: number | null; status: string | null }[];
  payables: { account_id: string | null; original_amount: number | null; discount_amount: number | null; interest_amount: number | null; status: string | null }[];
  cashTransactions: { account_id: string | null; amount: number | null; transaction_type: string | null; category: string | null; reference_type: string | null; reference_id: string | null }[];
}

interface BalanceSources {
  stockItems: { total_value: number | null }[];
  accountsPayable: { remaining_amount: number }[];
  accountsReceivable: { remaining_amount: number }[];
  bankAccounts: { current_balance: number | null }[];
}

interface CashFlowSource {
  description: string;
  category: string | null;
  amount: number;
  transaction_type: string;
}

const EMPTY_DRE_SOURCES: DRESources = { accounts: [], receivables: [], payables: [], cashTransactions: [] };
const EMPTY_BALANCE_SOURCES: BalanceSources = { stockItems: [], accountsPayable: [], accountsReceivable: [], bankAccounts: [] };
const EMPTY_CASHFLOW: CashFlowSource[] = [];

// ─── Data fetching ───────────────────────────────────────────────────────────

async function fetchDRESources(start: string, end: string): Promise<DRESources> {
  // Buscar contas do plano de contas
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, level, parent_id')
    .in('account_type', ['Receitas', 'Despesas'])
    .eq('is_active', true)
    .order('code');

  if (accountsError) throw accountsError;

  // Buscar contas a receber (receitas realizadas)
  const { data: receivables, error: receivablesError } = await supabase
    .from('accounts_receivable')
    .select('account_id, original_amount, discount_amount, interest_amount, status')
    .gte('issue_date', start)
    .lte('issue_date', end);

  if (receivablesError) throw receivablesError;

  // Buscar contas a pagar (despesas realizadas)
  const { data: payables, error: payablesError } = await supabase
    .from('accounts_payable')
    .select('account_id, original_amount, discount_amount, interest_amount, status')
    .gte('issue_date', start)
    .lte('issue_date', end);

  if (payablesError) throw payablesError;

  // Buscar transações de caixa para complementar
  const { data: cashTransactions, error: cashError } = await supabase
    .from('cash_transactions')
    .select('account_id, amount, transaction_type, category, reference_type, reference_id')
    .gte('transaction_date', start)
    .lte('transaction_date', end);

  if (cashError) throw cashError;

  return {
    accounts: (accounts as unknown as AccountRow[]) || [],
    receivables: receivables || [],
    payables: payables || [],
    cashTransactions: cashTransactions || [],
  };
}

async function fetchBalanceSources(): Promise<BalanceSources> {
  const { data: stockItems, error: stockError } = await supabase
    .from('stock_items')
    .select('total_value');

  if (stockError) throw stockError;

  const { data: accountsPayable, error: payableError } = await supabase
    .from('accounts_payable')
    .select('remaining_amount')
    .eq('status', 'Pendente');

  if (payableError) throw payableError;

  const { data: accountsReceivable, error: receivableError } = await supabase
    .from('accounts_receivable')
    .select('remaining_amount')
    .eq('status', 'Pendente');

  if (receivableError) throw receivableError;

  const { data: bankAccounts, error: bankError } = await supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('is_active', true);

  if (bankError) throw bankError;

  return {
    stockItems: stockItems || [],
    accountsPayable: accountsPayable || [],
    accountsReceivable: accountsReceivable || [],
    bankAccounts: bankAccounts || [],
  };
}

async function fetchCashFlowSources(start: string, end: string): Promise<CashFlowSource[]> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('description, category, amount, transaction_type')
    .gte('transaction_date', start)
    .lte('transaction_date', end);

  if (error) throw error;
  return (data as unknown as CashFlowSource[]) || [];
}

// ─── Computação dos relatórios ───────────────────────────────────────────────

function computeIncomeStatement(sources: DRESources): DRELine[] {
  const { accounts, receivables, payables, cashTransactions } = sources;

  // Mapear valores por conta contábil
  const accountValues = new Map<string, number>();

  // Processar receitas (contas a receber)
  receivables.forEach(item => {
    if (item.account_id) {
      const current = accountValues.get(item.account_id) || 0;
      accountValues.set(item.account_id, current + (item.original_amount || 0));
    }
  });

  // Processar despesas (contas a pagar)
  payables.forEach(item => {
    if (item.account_id) {
      const current = accountValues.get(item.account_id) || 0;
      accountValues.set(item.account_id, current + (item.original_amount || 0));
    }
  });

  // Processar transações de caixa - APENAS receitas/despesas não contabilizadas em AR/AP
  // Para evitar duplicação, excluímos transações que tenham reference_id (vinculadas a AP/AR)
  cashTransactions.forEach(item => {
    if (item.account_id && !item.reference_id) {
      const current = accountValues.get(item.account_id) || 0;
      accountValues.set(item.account_id, current + (item.amount || 0));
    }
  });

  // Calcular valores por código de conta (agregando hierarquicamente)
  const codeValues = new Map<string, number>();

  accounts.forEach(account => {
    const value = accountValues.get(account.id) || 0;
    codeValues.set(account.code, (codeValues.get(account.code) || 0) + value);
  });

  // Função para somar valores de subcontas
  const sumSubAccounts = (parentCode: string): number => {
    let sum = codeValues.get(parentCode) || 0;
    accounts.forEach(account => {
      if (account.code.startsWith(parentCode + '.') && account.code !== parentCode) {
        sum += codeValues.get(account.code) || 0;
      }
    });
    return sum;
  };

  // Calcular valores do DRE seguindo a estrutura gerencial
  const receitaBruta = sumSubAccounts('4.1');
  const deducoes = sumSubAccounts('4.2');
  const receitaLiquida = receitaBruta - deducoes;

  const cpv = sumSubAccounts('5.1');
  const lucroBruto = receitaLiquida - cpv;

  const despesasAdministrativas = sumSubAccounts('5.2.1');
  const despesasComerciais = sumSubAccounts('5.2.2');
  const freteLogistica = sumSubAccounts('5.2.3');
  const despesasOperacionais = despesasAdministrativas + despesasComerciais + freteLogistica;

  const ebitda = lucroBruto - despesasOperacionais;

  const depreciacao = sumSubAccounts('5.4');
  const ebit = ebitda - depreciacao;

  const receitasFinanceiras = sumSubAccounts('4.3');
  const despesasFinanceiras = sumSubAccounts('5.3');
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;

  const lair = ebit + resultadoFinanceiro;
  const lucroLiquido = lair; // Impostos podem ser adicionados futuramente

  // Montar estrutura do DRE
  const dreLines: DRELine[] = [
    {
      code: '1',
      label: '(=) RECEITA OPERACIONAL BRUTA',
      value: receitaBruta,
      level: 0,
      isCalculated: true,
      isPositive: true,
      children: [
        { code: '1.1', label: 'Vendas de Produtos e Serviços', value: receitaBruta, level: 1 }
      ]
    },
    {
      code: '2',
      label: '(-) DEDUÇÕES DA RECEITA BRUTA',
      value: deducoes,
      level: 0,
      isCalculated: true,
      isPositive: false,
      children: [
        { code: '2.1', label: 'Devoluções de Vendas', value: codeValues.get('4.2.1') || 0, level: 1 },
        { code: '2.2', label: 'Descontos Concedidos', value: codeValues.get('4.2.2') || 0, level: 1 },
        { code: '2.3', label: 'Impostos sobre Vendas', value: sumSubAccounts('4.2.3'), level: 1 }
      ]
    },
    {
      code: '3',
      label: '(=) RECEITA OPERACIONAL LÍQUIDA',
      value: receitaLiquida,
      level: 0,
      isCalculated: true,
      isPositive: receitaLiquida >= 0
    },
    {
      code: '4',
      label: '(-) CUSTO DOS PRODUTOS VENDIDOS (CPV)',
      value: cpv,
      level: 0,
      isCalculated: true,
      isPositive: false,
      children: [
        { code: '4.1', label: 'Compras de Mercadorias', value: codeValues.get('5.1.1') || 0, level: 1 },
        { code: '4.2', label: 'Matéria-Prima', value: codeValues.get('5.1.2') || 0, level: 1 }
      ]
    },
    {
      code: '5',
      label: '(=) LUCRO BRUTO',
      value: lucroBruto,
      level: 0,
      isCalculated: true,
      isPositive: lucroBruto >= 0
    },
    {
      code: '6',
      label: '(-) DESPESAS OPERACIONAIS',
      value: despesasOperacionais,
      level: 0,
      isCalculated: true,
      isPositive: false,
      children: [
        { code: '6.1', label: 'Despesas Administrativas', value: despesasAdministrativas, level: 1 },
        { code: '6.2', label: 'Despesas Comerciais', value: despesasComerciais, level: 1 },
        { code: '6.3', label: 'Frete e Logística', value: freteLogistica, level: 1 }
      ]
    },
    {
      code: '7',
      label: '(=) EBITDA',
      value: ebitda,
      level: 0,
      isCalculated: true,
      isPositive: ebitda >= 0
    },
    {
      code: '8',
      label: '(-) DEPRECIAÇÃO E AMORTIZAÇÃO',
      value: depreciacao,
      level: 0,
      isCalculated: true,
      isPositive: false
    },
    {
      code: '9',
      label: '(=) EBIT (LUCRO OPERACIONAL)',
      value: ebit,
      level: 0,
      isCalculated: true,
      isPositive: ebit >= 0
    },
    {
      code: '10',
      label: '(+/-) RESULTADO FINANCEIRO',
      value: resultadoFinanceiro,
      level: 0,
      isCalculated: true,
      isPositive: resultadoFinanceiro >= 0,
      children: [
        { code: '10.1', label: '(+) Receitas Financeiras', value: receitasFinanceiras, level: 1, isPositive: true },
        { code: '10.2', label: '(-) Despesas Financeiras', value: despesasFinanceiras, level: 1, isPositive: false }
      ]
    },
    {
      code: '11',
      label: '(=) LAIR (LUCRO ANTES DO IR)',
      value: lair,
      level: 0,
      isCalculated: true,
      isPositive: lair >= 0
    },
    {
      code: '12',
      label: '(=) LUCRO LÍQUIDO DO EXERCÍCIO',
      value: lucroLiquido,
      level: 0,
      isCalculated: true,
      isPositive: lucroLiquido >= 0
    }
  ];

  return dreLines;
}

function computeBalanceSheet(sources: BalanceSources): BalanceSheetItem[] {
  const totalEstoque = sources.stockItems.reduce((sum, item) => sum + (item.total_value || 0), 0);
  const totalAPagar = sources.accountsPayable.reduce((sum, item) => sum + item.remaining_amount, 0);
  const totalAReceber = sources.accountsReceivable.reduce((sum, item) => sum + item.remaining_amount, 0);
  const totalBancos = sources.bankAccounts.reduce((sum, item) => sum + (item.current_balance || 0), 0);

  const balanceItems: BalanceSheetItem[] = [
    { account_code: '1', account_name: 'ATIVO', account_type: 'Ativo', balance: 0, level: 1 },
    { account_code: '1.1', account_name: 'ATIVO CIRCULANTE', account_type: 'Ativo', balance: 0, level: 2 },
    { account_code: '1.1.1', account_name: 'Disponível', account_type: 'Ativo', balance: totalBancos, level: 3 },
    { account_code: '1.1.2', account_name: 'Clientes', account_type: 'Ativo', balance: totalAReceber, level: 3 },
    { account_code: '1.1.3', account_name: 'Estoque', account_type: 'Ativo', balance: totalEstoque, level: 3 },

    { account_code: '2', account_name: 'PASSIVO', account_type: 'Passivo', balance: 0, level: 1 },
    { account_code: '2.1', account_name: 'PASSIVO CIRCULANTE', account_type: 'Passivo', balance: 0, level: 2 },
    { account_code: '2.1.1', account_name: 'Fornecedores', account_type: 'Passivo', balance: totalAPagar, level: 3 },

    { account_code: '3', account_name: 'PATRIMÔNIO LÍQUIDO', account_type: 'Patrimônio Líquido', balance: 0, level: 1 },
  ];

  const totalAtivoCirculante = totalBancos + totalAReceber + totalEstoque;
  const totalPassivoCirculante = totalAPagar;
  const patrimonioLiquido = totalAtivoCirculante - totalPassivoCirculante;

  balanceItems.find(item => item.account_code === '1.1')!.balance = totalAtivoCirculante;
  balanceItems.find(item => item.account_code === '1')!.balance = totalAtivoCirculante;
  balanceItems.find(item => item.account_code === '2.1')!.balance = totalPassivoCirculante;
  balanceItems.find(item => item.account_code === '2')!.balance = totalPassivoCirculante;
  balanceItems.find(item => item.account_code === '3')!.balance = patrimonioLiquido;

  return balanceItems;
}

function computeCashFlowStatement(transactions: CashFlowSource[]): CashFlowStatement[] {
  const cashFlowItems: CashFlowStatement[] = [];

  const investmentCategories = ['Equipamentos', 'Imobilizado', 'Investimento'];
  const financingCategories = ['Empréstimos', 'Capital', 'Financiamento'];

  transactions.forEach(transaction => {
    let type: 'operational' | 'investment' | 'financing' = 'operational';

    if (investmentCategories.some(cat => transaction.category?.includes(cat))) {
      type = 'investment';
    } else if (financingCategories.some(cat => transaction.category?.includes(cat))) {
      type = 'financing';
    }

    cashFlowItems.push({
      category: type === 'operational' ? 'Atividades Operacionais' :
               type === 'investment' ? 'Atividades de Investimento' : 'Atividades de Financiamento',
      description: transaction.description,
      amount: transaction.transaction_type === 'Entrada' ? transaction.amount : -transaction.amount,
      type
    });
  });

  return cashFlowItems;
}

const RelatoriosContabeis = () => {
  const [reportType, setReportType] = useState("dre");
  const [period, setPeriod] = useState("monthly");
  const [dateFilter, setDateFilter] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = endOfMonth(new Date(now.getFullYear(), quarter * 3 + 2, 1));
        break;
      }
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    setDateFilter({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  }, [period]);

  // ─── Queries (uma por tipo de relatório, só ativa na aba correspondente) ─────

  const {
    data: dreSources = EMPTY_DRE_SOURCES,
    isPending: drePending,
    isError: dreError,
  } = useQuery({
    queryKey: ['relatorios-contabeis', 'dre', dateFilter.start, dateFilter.end],
    queryFn: () => fetchDRESources(dateFilter.start, dateFilter.end),
    enabled: reportType === 'dre',
  });

  const {
    data: balanceSources = EMPTY_BALANCE_SOURCES,
    isPending: balancePending,
    isError: balanceError,
  } = useQuery({
    queryKey: ['relatorios-contabeis', 'balanco'],
    queryFn: () => fetchBalanceSources(),
    enabled: reportType === 'balanco',
  });

  const {
    data: cashFlowSources = EMPTY_CASHFLOW,
    isPending: cashFlowPending,
    isError: cashFlowError,
  } = useQuery({
    queryKey: ['relatorios-contabeis', 'fluxo-caixa', dateFilter.start, dateFilter.end],
    queryFn: () => fetchCashFlowSources(dateFilter.start, dateFilter.end),
    enabled: reportType === 'fluxo-caixa',
  });

  // isPending é true mesmo quando a query está desabilitada; gate o loading pela aba ativa
  const loading =
    (reportType === 'dre' && drePending) ||
    (reportType === 'balanco' && balancePending) ||
    (reportType === 'fluxo-caixa' && cashFlowPending);

  useEffect(() => {
    if (dreError) toast.error('Erro ao gerar DRE');
  }, [dreError]);

  useEffect(() => {
    if (balanceError) toast.error('Erro ao gerar Balanço Patrimonial');
  }, [balanceError]);

  useEffect(() => {
    if (cashFlowError) toast.error('Erro ao gerar Demonstração de Fluxo de Caixa');
  }, [cashFlowError]);

  const dreData = useMemo(() => computeIncomeStatement(dreSources), [dreSources]);
  const balanceSheet = useMemo(() => computeBalanceSheet(balanceSources), [balanceSources]);
  const cashFlowStatement = useMemo(() => computeCashFlowStatement(cashFlowSources), [cashFlowSources]);

  const toggleRow = (code: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedRows(newExpanded);
  };

  const exportReport = () => {
    toast.info('Funcionalidade de exportação será implementada em breve');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const renderDRERow = (line: DRELine, depth = 0) => {
    const hasChildren = line.children && line.children.length > 0;
    const isExpanded = expandedRows.has(line.code);
    const isMainLine = line.level === 0;
    const isResult = line.code === '12';

    return (
      <>
        <TableRow
          key={line.code}
          className={`
            ${isMainLine ? 'font-semibold bg-muted/30' : ''}
            ${isResult ? 'font-bold bg-primary/10 text-primary' : ''}
            ${hasChildren ? 'cursor-pointer hover:bg-muted/50' : ''}
          `}
          onClick={() => hasChildren && toggleRow(line.code)}
        >
          <TableCell className="w-10">
            {hasChildren && (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
          </TableCell>
          <TableCell
            className="font-medium"
            style={{ paddingLeft: `${depth * 24 + 8}px` }}
          >
            {line.label}
          </TableCell>
          <TableCell className={`text-right font-mono ${
            line.isPositive === false ? 'text-red-600' :
            line.isPositive === true ? 'text-green-600' : ''
          }`}>
            {line.isPositive === false ? `(${formatCurrency(line.value)})` : formatCurrency(line.value)}
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && line.children?.map(child => renderDRERow(child, depth + 1))}
      </>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios Contábeis</h1>
        <p className="text-muted-foreground">
          DRE Gerencial, Balanço Patrimonial e Fluxo de Caixa
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div>
          <Label htmlFor="period">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
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
        <div className="flex items-end">
          <Button onClick={exportReport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Relatórios */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dre">DRE Gerencial</TabsTrigger>
          <TabsTrigger value="balanco">Balanço Patrimonial</TabsTrigger>
          <TabsTrigger value="fluxo-caixa">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Demonstração do Resultado do Exercício (DRE)
              </CardTitle>
              <CardDescription>
                Período: {format(new Date(dateFilter.start), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(dateFilter.end), 'dd/MM/yyyy', { locale: ptBR })}
                <br />
                <span className="text-xs text-muted-foreground">Clique nas linhas com seta para expandir/recolher detalhes</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-6 text-center">Carregando relatório...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right w-40">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreData.map(line => renderDRERow(line))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balanco">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Balanço Patrimonial
              </CardTitle>
              <CardDescription>
                Posição em: {format(new Date(dateFilter.end), 'dd/MM/yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-6 text-center">Carregando relatório...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceSheet.map((item, index) => (
                      <TableRow key={index} className={item.level === 1 ? 'font-bold bg-muted/30' : ''}>
                        <TableCell
                          className="font-mono"
                          style={{ paddingLeft: `${item.level * 20}px` }}
                        >
                          {item.account_code}
                        </TableCell>
                        <TableCell>{item.account_name}</TableCell>
                        <TableCell className={`text-right ${
                          item.account_type === 'Patrimônio Líquido'
                            ? item.balance >= 0 ? 'text-green-600' : 'text-red-600'
                            : ''
                        }`}>
                          {formatCurrency(item.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fluxo-caixa">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Demonstração de Fluxo de Caixa
              </CardTitle>
              <CardDescription>
                Período: {format(new Date(dateFilter.start), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(dateFilter.end), 'dd/MM/yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-6 text-center">Carregando relatório...</div>
              ) : (
                <>
                  {['operational', 'investment', 'financing'].map(type => {
                    const items = cashFlowStatement.filter(item => item.type === type);
                    const total = items.reduce((sum, item) => sum + item.amount, 0);
                    const title = type === 'operational' ? 'Atividades Operacionais' :
                                  type === 'investment' ? 'Atividades de Investimento' : 'Atividades de Financiamento';

                    return (
                      <div key={type} className="mb-6">
                        <h3 className="font-semibold text-lg mb-2">{title}</h3>
                        <Table>
                          <TableBody>
                            {items.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                  Nenhuma movimentação no período
                                </TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {items.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(item.amount)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="font-semibold bg-muted/30">
                                  <TableCell>Subtotal</TableCell>
                                  <TableCell className={`text-right ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(total)}
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}

                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Variação Líquida de Caixa</span>
                      <span className={cashFlowStatement.reduce((sum, item) => sum + item.amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(cashFlowStatement.reduce((sum, item) => sum + item.amount, 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RelatoriosContabeis;

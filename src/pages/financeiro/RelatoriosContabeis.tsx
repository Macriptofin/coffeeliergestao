import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Download, Calculator, TrendingUp, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BalanceSheetItem {
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
  level: number;
}

interface IncomeStatement {
  account_code: string;
  account_name: string;
  account_type: string;
  amount: number;
  level: number;
}

interface CashFlowStatement {
  category: string;
  description: string;
  amount: number;
  type: 'operational' | 'investment' | 'financing';
}

const RelatoriosContabeis = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("dre");
  const [period, setPeriod] = useState("monthly");
  const [dateFilter, setDateFilter] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetItem[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement[]>([]);
  const [cashFlowStatement, setCashFlowStatement] = useState<CashFlowStatement[]>([]);

  useEffect(() => {
    updateDateFilter();
  }, [period]);

  useEffect(() => {
    if (reportType === 'dre') {
      generateIncomeStatement();
    } else if (reportType === 'balanco') {
      generateBalanceSheet();
    } else if (reportType === 'fluxo-caixa') {
      generateCashFlowStatement();
    }
  }, [reportType, dateFilter]);

  const updateDateFilter = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = endOfMonth(new Date(now.getFullYear(), quarter * 3 + 2, 1));
        break;
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
  };

  const generateIncomeStatement = async () => {
    try {
      setLoading(true);
      
      // Buscar receitas
      const { data: revenues, error: revenuesError } = await supabase
        .from('cash_transactions')
        .select('category, amount')
        .eq('transaction_type', 'Entrada')
        .gte('transaction_date', dateFilter.start)
        .lte('transaction_date', dateFilter.end);

      if (revenuesError) throw revenuesError;

      // Buscar despesas
      const { data: expenses, error: expensesError } = await supabase
        .from('cash_transactions')
        .select('category, amount')
        .eq('transaction_type', 'Saída')
        .gte('transaction_date', dateFilter.start)
        .lte('transaction_date', dateFilter.end);

      if (expensesError) throw expensesError;

      // Processar dados para DRE
      const revenuesByCategory = new Map<string, number>();
      (revenues || []).forEach(item => {
        const current = revenuesByCategory.get(item.category) || 0;
        revenuesByCategory.set(item.category, current + item.amount);
      });

      const expensesByCategory = new Map<string, number>();
      (expenses || []).forEach(item => {
        const current = expensesByCategory.get(item.category) || 0;
        expensesByCategory.set(item.category, current + item.amount);
      });

      const dreItems: IncomeStatement[] = [];
      
      // Receitas
      let totalReceitas = 0;
      dreItems.push({ 
        account_code: '4', 
        account_name: 'RECEITAS', 
        account_type: 'Receitas',
        amount: 0, 
        level: 1 
      });
      
      Array.from(revenuesByCategory.entries()).forEach(([category, amount]) => {
        dreItems.push({
          account_code: '4.1',
          account_name: category,
          account_type: 'Receitas',
          amount,
          level: 2
        });
        totalReceitas += amount;
      });

      // Atualizar total de receitas
      dreItems[0].amount = totalReceitas;

      // Despesas
      let totalDespesas = 0;
      dreItems.push({ 
        account_code: '5', 
        account_name: 'DESPESAS', 
        account_type: 'Despesas',
        amount: 0, 
        level: 1 
      });
      
      Array.from(expensesByCategory.entries()).forEach(([category, amount]) => {
        dreItems.push({
          account_code: '5.1',
          account_name: category,
          account_type: 'Despesas',
          amount,
          level: 2
        });
        totalDespesas += amount;
      });

      // Atualizar total de despesas
      const despesasIndex = dreItems.findIndex(item => item.account_name === 'DESPESAS');
      dreItems[despesasIndex].amount = totalDespesas;

      // Resultado
      const resultadoLiquido = totalReceitas - totalDespesas;
      dreItems.push({
        account_code: '6',
        account_name: 'RESULTADO LÍQUIDO',
        account_type: resultadoLiquido >= 0 ? 'Receitas' : 'Despesas',
        amount: Math.abs(resultadoLiquido),
        level: 1
      });

      setIncomeStatement(dreItems);
    } catch (error) {
      console.error('Error generating income statement:', error);
      toast.error('Erro ao gerar DRE');
    } finally {
      setLoading(false);
    }
  };

  const generateBalanceSheet = async () => {
    try {
      setLoading(true);
      
      // Para um balanço patrimonial simplificado, vamos usar dados básicos
      // Em um sistema real, isso seria mais complexo com dados de ativos, passivos, etc.
      
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

      const totalEstoque = (stockItems || []).reduce((sum, item) => sum + (item.total_value || 0), 0);
      const totalAPagar = (accountsPayable || []).reduce((sum, item) => sum + item.remaining_amount, 0);
      const totalAReceber = (accountsReceivable || []).reduce((sum, item) => sum + item.remaining_amount, 0);

      const balanceItems: BalanceSheetItem[] = [
        // ATIVO
        { account_code: '1', account_name: 'ATIVO', account_type: 'Ativo', balance: 0, level: 1 },
        { account_code: '1.1', account_name: 'ATIVO CIRCULANTE', account_type: 'Ativo', balance: 0, level: 2 },
        { account_code: '1.1.1', account_name: 'Clientes', account_type: 'Ativo', balance: totalAReceber, level: 3 },
        { account_code: '1.1.2', account_name: 'Estoque', account_type: 'Ativo', balance: totalEstoque, level: 3 },
        
        // PASSIVO
        { account_code: '2', account_name: 'PASSIVO', account_type: 'Passivo', balance: 0, level: 1 },
        { account_code: '2.1', account_name: 'PASSIVO CIRCULANTE', account_type: 'Passivo', balance: 0, level: 2 },
        { account_code: '2.1.1', account_name: 'Fornecedores', account_type: 'Passivo', balance: totalAPagar, level: 3 },
        
        // PATRIMÔNIO LÍQUIDO
        { account_code: '3', account_name: 'PATRIMÔNIO LÍQUIDO', account_type: 'Patrimônio Líquido', balance: 0, level: 1 },
      ];

      // Calcular totais
      const totalAtivoCirculante = totalAReceber + totalEstoque;
      const totalPassivoCirculante = totalAPagar;
      const patrimonioLiquido = totalAtivoCirculante - totalPassivoCirculante;

      // Atualizar totais
      balanceItems.find(item => item.account_code === '1.1')!.balance = totalAtivoCirculante;
      balanceItems.find(item => item.account_code === '1')!.balance = totalAtivoCirculante;
      balanceItems.find(item => item.account_code === '2.1')!.balance = totalPassivoCirculante;
      balanceItems.find(item => item.account_code === '2')!.balance = totalPassivoCirculante;
      balanceItems.find(item => item.account_code === '3')!.balance = patrimonioLiquido;

      setBalanceSheet(balanceItems);
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      toast.error('Erro ao gerar Balanço Patrimonial');
    } finally {
      setLoading(false);
    }
  };

  const generateCashFlowStatement = async () => {
    try {
      setLoading(true);
      
      const { data: transactions, error } = await supabase
        .from('cash_transactions')
        .select('description, category, amount, transaction_type')
        .gte('transaction_date', dateFilter.start)
        .lte('transaction_date', dateFilter.end);

      if (error) throw error;

      const cashFlowItems: CashFlowStatement[] = [];

      // Atividades Operacionais
      const operationalCategories = ['Vendas', 'Recebimento de Clientes', 'Pagamento de Fornecedores', 'Salários'];
      const operationalTransactions = (transactions || []).filter(t => 
        operationalCategories.some(cat => t.category.includes(cat))
      );

      operationalTransactions.forEach(transaction => {
        cashFlowItems.push({
          category: 'Atividades Operacionais',
          description: transaction.description,
          amount: transaction.transaction_type === 'Entrada' ? transaction.amount : -transaction.amount,
          type: 'operational'
        });
      });

      // Atividades de Investimento
      const investmentCategories = ['Equipamentos', 'Imobilizado'];
      const investmentTransactions = (transactions || []).filter(t => 
        investmentCategories.some(cat => t.category.includes(cat))
      );

      investmentTransactions.forEach(transaction => {
        cashFlowItems.push({
          category: 'Atividades de Investimento',
          description: transaction.description,
          amount: transaction.transaction_type === 'Entrada' ? transaction.amount : -transaction.amount,
          type: 'investment'
        });
      });

      // Atividades de Financiamento
      const financingCategories = ['Empréstimos', 'Capital'];
      const financingTransactions = (transactions || []).filter(t => 
        financingCategories.some(cat => t.category.includes(cat))
      );

      financingTransactions.forEach(transaction => {
        cashFlowItems.push({
          category: 'Atividades de Financiamento',
          description: transaction.description,
          amount: transaction.transaction_type === 'Entrada' ? transaction.amount : -transaction.amount,
          type: 'financing'
        });
      });

      setCashFlowStatement(cashFlowItems);
    } catch (error) {
      console.error('Error generating cash flow statement:', error);
      toast.error('Erro ao gerar Demonstração de Fluxo de Caixa');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    toast.info('Funcionalidade de exportação será implementada em breve');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios Contábeis</h1>
        <p className="text-muted-foreground">
          DRE, Balanço Patrimonial e relatórios para contabilidade
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
          <TabsTrigger value="dre">DRE</TabsTrigger>
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
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeStatement.map((item, index) => (
                      <TableRow key={index} className={item.level === 1 ? 'font-bold' : ''}>
                        <TableCell 
                          className="font-mono"
                          style={{ paddingLeft: `${item.level * 20}px` }}
                        >
                          {item.account_code}
                        </TableCell>
                        <TableCell>{item.account_name}</TableCell>
                        <TableCell className={`text-right ${
                          item.account_name === 'RESULTADO LÍQUIDO' 
                            ? item.account_type === 'Receitas' ? 'text-green-600' : 'text-red-600'
                            : item.account_type === 'Receitas' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <TableRow key={index} className={item.level === 1 ? 'font-bold' : ''}>
                        <TableCell 
                          className="font-mono"
                          style={{ paddingLeft: `${item.level * 20}px` }}
                        >
                          {item.account_code}
                        </TableCell>
                        <TableCell>{item.account_name}</TableCell>
                        <TableCell className="text-right">
                          {item.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                Demonstração do Fluxo de Caixa
              </CardTitle>
              <CardDescription>
                Período: {format(new Date(dateFilter.start), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(dateFilter.end), 'dd/MM/yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-6 text-center">Carregando relatório...</div>
              ) : (
                <div className="space-y-6">
                  {['operational', 'investment', 'financing'].map((type) => {
                    const items = cashFlowStatement.filter(item => item.type === type);
                    const total = items.reduce((sum, item) => sum + item.amount, 0);
                    const categoryName = {
                      operational: 'Atividades Operacionais',
                      investment: 'Atividades de Investimento',
                      financing: 'Atividades de Financiamento'
                    }[type];

                    return (
                      <div key={type}>
                        <h3 className="text-lg font-semibold mb-2">{categoryName}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className={`text-right ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell>Total - {categoryName}</TableCell>
                              <TableCell className={`text-right ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                  
                  <div className="pt-4 border-t-2">
                    <Table>
                      <TableBody>
                        <TableRow className="font-bold text-lg">
                          <TableCell>Variação Líquida do Caixa</TableCell>
                          <TableCell className={`text-right ${
                            cashFlowStatement.reduce((sum, item) => sum + item.amount, 0) >= 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {cashFlowStatement.reduce((sum, item) => sum + item.amount, 0)
                              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RelatoriosContabeis;
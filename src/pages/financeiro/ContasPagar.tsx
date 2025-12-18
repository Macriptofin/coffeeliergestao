import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, DollarSign, Calendar, Receipt, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccountPayable {
  id: string;
  supplier_id?: string;
  suppliers?: { company_name: string };
  invoice_number?: string;
  description: string;
  document_number?: string;
  issue_date: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  interest_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  cost_center_id?: string;
  cost_centers?: { name: string };
  account_id?: string;
  chart_of_accounts?: { name: string };
  notes?: string;
}

interface Supplier {
  id: string;
  company_name: string;
}

interface CostCenter {
  id: string;
  name: string;
  code: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

const ContasPagar = () => {
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountPayable | null>(null);
  const [paymentData, setPaymentData] = useState({
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'Dinheiro',
    amount: '',
    notes: ''
  });
  const [formData, setFormData] = useState({
    supplier_id: "",
    invoice_number: "",
    description: "",
    document_number: "",
    issue_date: "",
    due_date: "",
    original_amount: "",
    discount_amount: "0",
    interest_amount: "0",
    cost_center_id: "",
    account_id: "",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, suppliersRes, costCentersRes, chartAccountsRes] = await Promise.all([
        supabase
          .from('accounts_payable')
          .select(`
            *,
            suppliers(company_name),
            cost_centers(name),
            chart_of_accounts(name)
          `)
          .order('due_date', { ascending: false }),
        supabase.from('suppliers').select('id, company_name').eq('status', 'Ativo'),
        supabase.from('cost_centers').select('id, name, code').eq('is_active', true).order('code'),
        supabase.from('chart_of_accounts').select('id, name, code').eq('is_active', true).eq('account_type', 'Despesas').order('code')
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (costCentersRes.error) throw costCentersRes.error;
      if (chartAccountsRes.error) throw chartAccountsRes.error;

      setAccounts(accountsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setCostCenters(costCentersRes.data || []);
      setChartAccounts(chartAccountsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const originalAmount = parseFloat(formData.original_amount);
      const discountAmount = parseFloat(formData.discount_amount) || 0;
      const interestAmount = parseFloat(formData.interest_amount) || 0;
      const remainingAmount = originalAmount + interestAmount - discountAmount;

      const { error } = await supabase
        .from('accounts_payable')
        .insert([{
          ...formData,
          supplier_id: formData.supplier_id || null,
          cost_center_id: formData.cost_center_id || null,
          account_id: formData.account_id || null,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          interest_amount: interestAmount,
          remaining_amount: remainingAmount
        }]);

      if (error) throw error;

      toast.success('Conta a pagar cadastrada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating account payable:', error);
      toast.error('Erro ao cadastrar conta a pagar');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: "",
      invoice_number: "",
      description: "",
      document_number: "",
      issue_date: "",
      due_date: "",
      original_amount: "",
      discount_amount: "0",
      interest_amount: "0",
      cost_center_id: "",
      account_id: "",
      notes: ""
    });
  };

  const handlePayment = (account: AccountPayable) => {
    setSelectedAccount(account);
    setPaymentData({
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      payment_method: 'Dinheiro',
      amount: account.remaining_amount.toString(),
      notes: ''
    });
    setPaymentDialogOpen(true);
  };

  const processPayment = async () => {
    if (!selectedAccount) return;

    try {
      const paymentAmount = parseFloat(paymentData.amount);
      
      // Criar transação de pagamento
      const { data: paymentTransaction, error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          account_payable_id: selectedAccount.id,
          payment_date: paymentData.payment_date,
          amount: paymentAmount,
          payment_method: paymentData.payment_method,
          notes: paymentData.notes
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      toast.success('Pagamento registrado com sucesso!');
      setPaymentDialogOpen(false);
      setSelectedAccount(null);
      setPaymentData({
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: 'Dinheiro',
        amount: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao registrar pagamento');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'Pendente': { variant: 'secondary' as const, color: 'bg-yellow-500' },
      'Pago': { variant: 'secondary' as const, color: 'bg-green-500' },
      'Vencido': { variant: 'destructive' as const, color: 'bg-red-500' },
      'Cancelado': { variant: 'outline' as const, color: 'bg-gray-500' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.Pendente;
    return <Badge variant={config.variant}>{status}</Badge>;
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.suppliers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalPendente = accounts
    .filter(acc => acc.status === 'Pendente')
    .reduce((sum, acc) => sum + acc.remaining_amount, 0);

  const totalVencido = accounts
    .filter(acc => acc.status === 'Vencido')
    .reduce((sum, acc) => sum + acc.remaining_amount, 0);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Contas a Pagar</h1>
        <p className="text-muted-foreground">
          Controle de fornecedores, duplicatas e pagamentos
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalVencido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por descrição, fornecedor ou número da nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Pago">Pago</SelectItem>
            <SelectItem value="Vencido">Vencido</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Conta a Pagar</DialogTitle>
              <DialogDescription>
                Cadastre uma nova conta a pagar no sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier_id">Fornecedor</Label>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({...formData, supplier_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="invoice_number">Número da Nota</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                    placeholder="Ex: NF-12345"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Descrição da conta"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issue_date">Data de Emissão *</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="due_date">Data de Vencimento *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="original_amount">Valor Original *</Label>
                  <Input
                    id="original_amount"
                    type="number"
                    step="0.01"
                    value={formData.original_amount}
                    onChange={(e) => setFormData({...formData, original_amount: e.target.value})}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discount_amount">Desconto</Label>
                  <Input
                    id="discount_amount"
                    type="number"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({...formData, discount_amount: e.target.value})}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="interest_amount">Juros</Label>
                  <Input
                    id="interest_amount"
                    type="number"
                    step="0.01"
                    value={formData.interest_amount}
                    onChange={(e) => setFormData({...formData, interest_amount: e.target.value})}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cost_center_id">Centro de Custo</Label>
                  <Select value={formData.cost_center_id} onValueChange={(value) => setFormData({...formData, cost_center_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.code} - {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="account_id">Conta Contábil</Label>
                  <Select value={formData.account_id} onValueChange={(value) => setFormData({...formData, account_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {chartAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Observações adicionais"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Contas a Pagar</CardTitle>
          <CardDescription>
            {filteredAccounts.length} conta(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>Valor Pago</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.suppliers?.company_name || '-'}</TableCell>
                  <TableCell>{account.description}</TableCell>
                  <TableCell>
                    {format(new Date(account.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(account.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {account.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>
                    {account.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>
                    {account.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
                  <TableCell>
                    {account.status === 'Pendente' && account.remaining_amount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePayment(account)}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Pagamento */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Efetuar Pagamento</DialogTitle>
            <DialogDescription>
              Registrar pagamento da conta: {selectedAccount?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment_date">Data do Pagamento *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="payment_method">Forma de Pagamento *</Label>
              <Select
                value={paymentData.payment_method}
                onValueChange={(value) => setPaymentData(prev => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payment_amount">Valor do Pagamento *</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saldo pendente: {selectedAccount?.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div>
              <Label htmlFor="payment_notes">Observações</Label>
              <Textarea
                id="payment_notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre o pagamento"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={processPayment}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContasPagar;
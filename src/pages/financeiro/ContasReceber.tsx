import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Search, DollarSign, Calendar, Receipt, CheckCircle, Pencil, Eye, Trash2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccountReceivable {
  id: string;
  client_id?: string;
  clients?: { name: string };
  proposal_id?: string;
  proposals?: { proposal_number: string };
  invoice_number?: string;
  description: string;
  document_number?: string;
  issue_date: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  interest_amount: number;
  received_amount: number;
  remaining_amount: number;
  status: string;
  cost_center_id?: string;
  cost_centers?: { name: string };
  account_id?: string;
  chart_of_accounts?: { name: string };
  notes?: string;
}

interface Client {
  id: string;
  name: string;
}

interface Proposal {
  id: string;
  proposal_number: string;
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

const ContasReceber = () => {
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | null>(null);
  const [viewingAccount, setViewingAccount] = useState<AccountReceivable | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountReceivable | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountReceivable | null>(null);
  const [receiptData, setReceiptData] = useState({
    receipt_date: format(new Date(), 'yyyy-MM-dd'),
    receipt_method: 'Dinheiro',
    amount: '',
    notes: ''
  });
  const [formData, setFormData] = useState({
    client_id: "",
    proposal_id: "",
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
  const [editFormData, setEditFormData] = useState({
    client_id: "",
    proposal_id: "",
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
    notes: "",
    status: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, clientsRes, proposalsRes, costCentersRes, chartAccountsRes] = await Promise.all([
        supabase
          .from('accounts_receivable')
          .select(`
            *,
            clients(name),
            proposals(proposal_number),
            cost_centers(name),
            chart_of_accounts(name)
          `)
          .order('due_date', { ascending: false }),
        supabase.from('clients').select('id, name').eq('status', 'Ativo'),
        supabase.from('proposals').select('id, proposal_number').order('proposal_number', { ascending: false }),
        supabase.from('cost_centers').select('id, name, code').eq('is_active', true).order('code'),
        supabase.from('chart_of_accounts').select('id, name, code').eq('is_active', true).eq('account_type', 'Receitas').order('code')
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (proposalsRes.error) throw proposalsRes.error;
      if (costCentersRes.error) throw costCentersRes.error;
      if (chartAccountsRes.error) throw chartAccountsRes.error;

      setAccounts(accountsRes.data || []);
      setClients(clientsRes.data || []);
      setProposals(proposalsRes.data || []);
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
        .from('accounts_receivable')
        .insert([{
          ...formData,
          client_id: formData.client_id || null,
          proposal_id: formData.proposal_id || null,
          cost_center_id: formData.cost_center_id || null,
          account_id: formData.account_id || null,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          interest_amount: interestAmount,
          remaining_amount: remainingAmount
        }]);

      if (error) throw error;

      toast.success('Conta a receber cadastrada com sucesso!');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating account receivable:', error);
      toast.error('Erro ao cadastrar conta a receber');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      proposal_id: "",
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

  const handleEdit = (account: AccountReceivable) => {
    setEditingAccount(account);
    setEditFormData({
      client_id: account.client_id || "",
      proposal_id: account.proposal_id || "",
      invoice_number: account.invoice_number || "",
      description: account.description,
      document_number: account.document_number || "",
      issue_date: account.issue_date,
      due_date: account.due_date,
      original_amount: account.original_amount.toString(),
      discount_amount: account.discount_amount.toString(),
      interest_amount: account.interest_amount.toString(),
      cost_center_id: account.cost_center_id || "",
      account_id: account.account_id || "",
      notes: account.notes || "",
      status: account.status
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      const originalAmount = parseFloat(editFormData.original_amount);
      const discountAmount = parseFloat(editFormData.discount_amount) || 0;
      const interestAmount = parseFloat(editFormData.interest_amount) || 0;
      
      // Calcular remaining_amount considerando o que já foi recebido
      const receivedAmount = editingAccount.received_amount || 0;
      const newTotal = originalAmount + interestAmount - discountAmount;
      const remainingAmount = Math.max(0, newTotal - receivedAmount);

      const { error } = await supabase
        .from('accounts_receivable')
        .update({
          client_id: editFormData.client_id || null,
          proposal_id: editFormData.proposal_id || null,
          invoice_number: editFormData.invoice_number || null,
          description: editFormData.description,
          document_number: editFormData.document_number || null,
          issue_date: editFormData.issue_date,
          due_date: editFormData.due_date,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          interest_amount: interestAmount,
          remaining_amount: remainingAmount,
          cost_center_id: editFormData.cost_center_id || null,
          account_id: editFormData.account_id || null,
          notes: editFormData.notes || null,
          status: editFormData.status
        })
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast.success('Conta a receber atualizada com sucesso!');
      setEditDialogOpen(false);
      setEditingAccount(null);
      fetchData();
    } catch (error) {
      console.error('Error updating account receivable:', error);
      toast.error('Erro ao atualizar conta a receber');
    }
  };

  const handleViewDetails = (account: AccountReceivable) => {
    setViewingAccount(account);
    setDetailsDialogOpen(true);
  };

  const handleDelete = (account: AccountReceivable) => {
    setDeletingAccount(account);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingAccount) return;

    try {
      const { error } = await supabase
        .from('accounts_receivable')
        .delete()
        .eq('id', deletingAccount.id);

      if (error) throw error;

      toast.success('Conta a receber excluída com sucesso!');
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting account receivable:', error);
      toast.error('Erro ao excluir conta a receber');
    }
  };

  const handleCancel = async (account: AccountReceivable) => {
    try {
      const { error } = await supabase
        .from('accounts_receivable')
        .update({ status: 'Cancelado' })
        .eq('id', account.id);

      if (error) throw error;

      toast.success('Conta cancelada com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Error canceling account receivable:', error);
      toast.error('Erro ao cancelar conta');
    }
  };

  const handleReceipt = (account: AccountReceivable) => {
    setSelectedAccount(account);
    setReceiptData({
      receipt_date: format(new Date(), 'yyyy-MM-dd'),
      receipt_method: 'Dinheiro',
      amount: account.remaining_amount.toString(),
      notes: ''
    });
    setReceiptDialogOpen(true);
  };

  const processReceipt = async () => {
    if (!selectedAccount) return;

    try {
      const receiptAmount = parseFloat(receiptData.amount);
      
      // Criar transação de recebimento
      const { data: receiptTransaction, error: receiptError } = await supabase
        .from('receipt_transactions')
        .insert({
          account_receivable_id: selectedAccount.id,
          receipt_date: receiptData.receipt_date,
          amount: receiptAmount,
          receipt_method: receiptData.receipt_method,
          notes: receiptData.notes
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      toast.success('Recebimento registrado com sucesso!');
      setReceiptDialogOpen(false);
      setSelectedAccount(null);
      setReceiptData({
        receipt_date: format(new Date(), 'yyyy-MM-dd'),
        receipt_method: 'Dinheiro',
        amount: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error processing receipt:', error);
      toast.error('Erro ao registrar recebimento');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'Pendente': { variant: 'secondary' as const, color: 'bg-yellow-500' },
      'Recebido': { variant: 'secondary' as const, color: 'bg-green-500' },
      'Parcial': { variant: 'secondary' as const, color: 'bg-blue-500' },
      'Vencido': { variant: 'destructive' as const, color: 'bg-red-500' },
      'Cancelado': { variant: 'outline' as const, color: 'bg-gray-500' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.Pendente;
    return <Badge variant={config.variant}>{status}</Badge>;
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalPendente = accounts
    .filter(acc => acc.status === 'Pendente' || acc.status === 'Parcial')
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Contas a Receber</h1>
        <p className="text-muted-foreground">
          Gestão de vendas, recebimentos e cobrança
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
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
              placeholder="Buscar por descrição, cliente ou número da nota..."
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
            <SelectItem value="Parcial">Parcial</SelectItem>
            <SelectItem value="Recebido">Recebido</SelectItem>
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
              <DialogTitle>Nova Conta a Receber</DialogTitle>
              <DialogDescription>
                Cadastre uma nova conta a receber no sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_id">Cliente</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({...formData, client_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="proposal_id">Proposta</Label>
                  <Select value={formData.proposal_id} onValueChange={(value) => setFormData({...formData, proposal_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a proposta" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposals.map((proposal) => (
                        <SelectItem key={proposal.id} value={proposal.id}>
                          {proposal.proposal_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_number">Número da Nota</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                    placeholder="Ex: NF-12345"
                  />
                </div>
                <div>
                  <Label htmlFor="document_number">Número do Documento</Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({...formData, document_number: e.target.value})}
                    placeholder="Ex: 001/2024"
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
          <CardTitle>Contas a Receber</CardTitle>
          <CardDescription>
            {filteredAccounts.length} conta(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>Valor Recebido</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <>
                  <TableRow 
                    key={account.id} 
                    className="cursor-pointer hover:bg-muted/50 border-b-0"
                    onClick={() => handleViewDetails(account)}
                  >
                    <TableCell className="font-medium pb-0">{account.clients?.name || '-'}</TableCell>
                    <TableCell className="pb-0">
                      {format(new Date(account.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="pb-0">
                      {format(new Date(account.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="pb-0">
                      {account.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0">
                      {account.received_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0">
                      {account.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0">{getStatusBadge(account.status)}</TableCell>
                    <TableCell className="pb-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(account)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(account)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {account.status !== 'Cancelado' && account.status !== 'Recebido' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancel(account)}
                            title="Cancelar"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(account)}
                          title="Excluir"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {(account.status === 'Pendente' || account.status === 'Parcial' || account.status === 'Vencido') && account.remaining_amount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReceipt(account)}
                            className="flex items-center gap-2 ml-1"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Receber
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {account.description && (
                    <TableRow 
                      key={`${account.id}-desc`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(account)}
                    >
                      <TableCell colSpan={8} className="pt-0 pb-3">
                        <span className="text-xs text-muted-foreground">{account.description}</span>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Recebimento */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Efetuar Recebimento</DialogTitle>
            <DialogDescription>
              Registrar recebimento da conta: {selectedAccount?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="receipt_date">Data do Recebimento *</Label>
              <Input
                id="receipt_date"
                type="date"
                value={receiptData.receipt_date}
                onChange={(e) => setReceiptData(prev => ({ ...prev, receipt_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="receipt_method">Forma de Recebimento *</Label>
              <Select
                value={receiptData.receipt_method}
                onValueChange={(value) => setReceiptData(prev => ({ ...prev, receipt_method: value }))}
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
              <Label htmlFor="receipt_amount">Valor do Recebimento *</Label>
              <Input
                id="receipt_amount"
                type="number"
                step="0.01"
                value={receiptData.amount}
                onChange={(e) => setReceiptData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saldo pendente: {selectedAccount?.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>

            <div>
              <Label htmlFor="receipt_notes">Observações</Label>
              <Textarea
                id="receipt_notes"
                value={receiptData.notes}
                onChange={(e) => setReceiptData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações sobre o recebimento"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={processReceipt}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Conta a Receber</DialogTitle>
            <DialogDescription>
              Atualize os dados da conta a receber
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_client_id">Cliente</Label>
                <Select value={editFormData.client_id} onValueChange={(value) => setEditFormData({...editFormData, client_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_status">Status</Label>
                <Select value={editFormData.status} onValueChange={(value) => setEditFormData({...editFormData, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Parcial">Parcial</SelectItem>
                    <SelectItem value="Recebido">Recebido</SelectItem>
                    <SelectItem value="Vencido">Vencido</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_invoice_number">Número da Nota</Label>
                <Input
                  id="edit_invoice_number"
                  value={editFormData.invoice_number}
                  onChange={(e) => setEditFormData({...editFormData, invoice_number: e.target.value})}
                  placeholder="Ex: NF-12345"
                />
              </div>
              <div>
                <Label htmlFor="edit_document_number">Número do Documento</Label>
                <Input
                  id="edit_document_number"
                  value={editFormData.document_number}
                  onChange={(e) => setEditFormData({...editFormData, document_number: e.target.value})}
                  placeholder="Ex: 001/2024"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_description">Descrição *</Label>
              <Input
                id="edit_description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                placeholder="Descrição da conta"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_issue_date">Data de Emissão *</Label>
                <Input
                  id="edit_issue_date"
                  type="date"
                  value={editFormData.issue_date}
                  onChange={(e) => setEditFormData({...editFormData, issue_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_due_date">Data de Vencimento *</Label>
                <Input
                  id="edit_due_date"
                  type="date"
                  value={editFormData.due_date}
                  onChange={(e) => setEditFormData({...editFormData, due_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit_original_amount">Valor Original *</Label>
                <Input
                  id="edit_original_amount"
                  type="number"
                  step="0.01"
                  value={editFormData.original_amount}
                  onChange={(e) => setEditFormData({...editFormData, original_amount: e.target.value})}
                  placeholder="0,00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_discount_amount">Desconto</Label>
                <Input
                  id="edit_discount_amount"
                  type="number"
                  step="0.01"
                  value={editFormData.discount_amount}
                  onChange={(e) => setEditFormData({...editFormData, discount_amount: e.target.value})}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="edit_interest_amount">Juros</Label>
                <Input
                  id="edit_interest_amount"
                  type="number"
                  step="0.01"
                  value={editFormData.interest_amount}
                  onChange={(e) => setEditFormData({...editFormData, interest_amount: e.target.value})}
                  placeholder="0,00"
                />
              </div>
            </div>

            {editingAccount && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Valor já recebido:</strong> {editingAccount.received_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Saldo pendente atual:</strong> {editingAccount.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_cost_center_id">Centro de Custo</Label>
                <Select value={editFormData.cost_center_id} onValueChange={(value) => setEditFormData({...editFormData, cost_center_id: value})}>
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
                <Label htmlFor="edit_account_id">Conta Contábil</Label>
                <Select value={editFormData.account_id} onValueChange={(value) => setEditFormData({...editFormData, account_id: value})}>
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
              <Label htmlFor="edit_notes">Observações</Label>
              <Textarea
                id="edit_notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                placeholder="Observações adicionais"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Detalhes da Conta a Receber
            </DialogTitle>
            <DialogDescription>
              Visualização completa dos dados da conta
            </DialogDescription>
          </DialogHeader>
          
          {viewingAccount && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewingAccount.clients?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(viewingAccount.status)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="font-medium">{viewingAccount.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número da Nota</p>
                  <p className="font-medium">{viewingAccount.invoice_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Número do Documento</p>
                  <p className="font-medium">{viewingAccount.document_number || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Proposta</p>
                  <p className="font-medium">{viewingAccount.proposals?.proposal_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Centro de Custo</p>
                  <p className="font-medium">{viewingAccount.cost_centers?.name || '-'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data de Emissão</p>
                  <p className="font-medium">{format(new Date(viewingAccount.issue_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Vencimento</p>
                  <p className="font-medium">{format(new Date(viewingAccount.due_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Original</p>
                  <p className="font-medium text-lg">{viewingAccount.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Desconto</p>
                  <p className="font-medium text-green-600">{viewingAccount.discount_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Juros/Multa</p>
                  <p className="font-medium text-red-600">{viewingAccount.interest_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Recebido</p>
                  <p className="font-medium text-lg text-green-600">{viewingAccount.received_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendente</p>
                  <p className="font-medium text-lg text-primary">{viewingAccount.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Conta Contábil</p>
                <p className="font-medium">{viewingAccount.chart_of_accounts?.name || '-'}</p>
              </div>

              {viewingAccount.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="font-medium">{viewingAccount.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setDetailsDialogOpen(false);
              if (viewingAccount) handleEdit(viewingAccount);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta a Receber?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                Esta ação não pode ser desfeita. A conta será permanentemente removida do sistema.
              </p>
              <p className="font-medium text-foreground">
                {deletingAccount?.description}
              </p>
              <p className="text-sm mt-1">
                Valor: {deletingAccount?.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-sm mt-4 text-amber-600 dark:text-amber-500">
                💡 <strong>Dica:</strong> Para manter o histórico financeiro, considere <em>cancelar</em> a conta ao invés de excluí-la.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContasReceber;

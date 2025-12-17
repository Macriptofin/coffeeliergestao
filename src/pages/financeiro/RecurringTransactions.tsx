import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Repeat, Plus, Edit, Trash2, Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_type: string;
  category: string;
  cost_center_id: string | null;
  account_id: string | null;
  bank_account_id: string | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_execution: string;
  last_execution: string | null;
  is_active: boolean;
  notes: string | null;
  cost_centers?: { name: string } | null;
  chart_of_accounts?: { name: string } | null;
  bank_accounts?: { name: string } | null;
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

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
}

const RecurringTransactions = () => {
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    transaction_type: "Saída",
    category: "",
    cost_center_id: "",
    account_id: "",
    bank_account_id: "",
    frequency: "monthly",
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: "",
    is_active: true,
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [transRes, costRes, accRes, bankRes] = await Promise.all([
        supabase
          .from('recurring_transactions')
          .select(`
            *,
            cost_centers(name),
            chart_of_accounts:account_id(name),
            bank_accounts(name)
          `)
          .order('next_execution'),
        supabase.from('cost_centers').select('id, name, code').eq('is_active', true),
        supabase.from('chart_of_accounts').select('id, name, code').eq('is_active', true),
        supabase.from('bank_accounts').select('id, name, bank_name').eq('is_active', true)
      ]);

      if (transRes.error) throw transRes.error;
      setTransactions(transRes.data || []);
      setCostCenters(costRes.data || []);
      setAccounts(accRes.data || []);
      setBankAccounts(bankRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: 0,
      transaction_type: "Saída",
      category: "",
      cost_center_id: "",
      account_id: "",
      bank_account_id: "",
      frequency: "monthly",
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: "",
      is_active: true,
      notes: ""
    });
    setEditingTransaction(null);
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      description: transaction.description,
      amount: transaction.amount,
      transaction_type: transaction.transaction_type,
      category: transaction.category,
      cost_center_id: transaction.cost_center_id || "",
      account_id: transaction.account_id || "",
      bank_account_id: transaction.bank_account_id || "",
      frequency: transaction.frequency,
      start_date: transaction.start_date,
      end_date: transaction.end_date || "",
      is_active: transaction.is_active,
      notes: transaction.notes || ""
    });
    setDialogOpen(true);
  };

  const calculateNextExecution = (startDate: string, frequency: string): string => {
    const date = new Date(startDate);
    const today = new Date();
    
    let nextDate = date;
    while (nextDate <= today) {
      switch (frequency) {
        case 'daily':
          nextDate = addDays(nextDate, 1);
          break;
        case 'weekly':
          nextDate = addWeeks(nextDate, 1);
          break;
        case 'monthly':
          nextDate = addMonths(nextDate, 1);
          break;
        case 'yearly':
          nextDate = addYears(nextDate, 1);
          break;
        default:
          nextDate = addMonths(nextDate, 1);
      }
    }
    
    return format(nextDate, 'yyyy-MM-dd');
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount || !formData.category) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);

      const nextExecution = calculateNextExecution(formData.start_date, formData.frequency);

      const payload = {
        description: formData.description,
        amount: formData.amount,
        transaction_type: formData.transaction_type,
        category: formData.category,
        cost_center_id: formData.cost_center_id || null,
        account_id: formData.account_id || null,
        bank_account_id: formData.bank_account_id || null,
        frequency: formData.frequency,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        next_execution: nextExecution,
        is_active: formData.is_active,
        notes: formData.notes || null
      };

      if (editingTransaction) {
        const { error } = await supabase
          .from('recurring_transactions')
          .update(payload)
          .eq('id', editingTransaction.id);

        if (error) throw error;
        toast.success('Transação recorrente atualizada');
      } else {
        const { error } = await supabase
          .from('recurring_transactions')
          .insert(payload);

        if (error) throw error;
        toast.success('Transação recorrente criada');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving recurring transaction:', error);
      toast.error('Erro ao salvar transação recorrente');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentState ? 'Transação pausada' : 'Transação ativada');
      fetchData();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação recorrente?')) return;

    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Transação excluída');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
      monthly: 'Mensal',
      yearly: 'Anual'
    };
    return labels[frequency] || frequency;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transações Recorrentes</h1>
          <p className="text-muted-foreground">Configure lançamentos automáticos periódicos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Recorrência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? 'Editar' : 'Nova'} Transação Recorrente</DialogTitle>
              <DialogDescription>
                Configure um lançamento que será executado automaticamente
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Aluguel mensal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction_type">Tipo</Label>
                  <Select
                    value={formData.transaction_type}
                    onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entrada">Entrada</SelectItem>
                      <SelectItem value="Saída">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Despesas Fixas"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequência</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim (opcional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_center_id">Centro de Custo</Label>
                <Select
                  value={formData.cost_center_id}
                  onValueChange={(value) => setFormData({ ...formData, cost_center_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_account_id">Conta Bancária</Label>
                <Select
                  value={formData.bank_account_id}
                  onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {bankAccounts.map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.name} - {ba.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Ativa</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Lançamentos Recorrentes
          </CardTitle>
          <CardDescription>
            Transações configuradas para execução automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação recorrente cadastrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Próxima Execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{t.description}</div>
                        <div className="text-xs text-muted-foreground">{t.category}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.transaction_type === 'Entrada' ? 'default' : 'secondary'}>
                        {t.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getFrequencyLabel(t.frequency)}</TableCell>
                    <TableCell className={`text-right font-medium ${t.transaction_type === 'Entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(t.next_execution), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? 'default' : 'outline'}>
                        {t.is_active ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(t.id, t.is_active)}
                        >
                          {t.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(t)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringTransactions;
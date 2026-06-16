import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
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
import { Building2, Plus, Edit, Trash2, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  agency_number: string | null;
  account_type: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
}

const EMPTY_ACCOUNTS: BankAccount[] = [];

async function fetchAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

const ContasBancarias = () => {
  const queryClient = useQueryClient();

  const {
    data: accounts = EMPTY_ACCOUNTS,
    isPending: loading,
    isError: accountsError,
  } = useQuery({ queryKey: ['bank-accounts'], queryFn: fetchAccounts });

  const showLoader = useDelayedLoading(loading);

  const refetchAccounts = () => queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accountsError) toast.error('Erro ao carregar contas bancárias');
  }, [accountsError]);

  const [formData, setFormData] = useState({
    name: "",
    bank_name: "",
    account_number: "",
    agency_number: "",
    account_type: "corrente",
    initial_balance: 0,
    is_active: true,
    is_default: false,
    notes: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      bank_name: "",
      account_number: "",
      agency_number: "",
      account_type: "corrente",
      initial_balance: 0,
      is_active: true,
      is_default: false,
      notes: ""
    });
    setEditingAccount(null);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank_name: account.bank_name,
      account_number: account.account_number || "",
      agency_number: account.agency_number || "",
      account_type: account.account_type,
      initial_balance: account.initial_balance,
      is_active: account.is_active,
      is_default: account.is_default,
      notes: account.notes || ""
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.bank_name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);

      // Se marcando como padrão, desmarcar outras
      if (formData.is_default) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .neq('id', editingAccount?.id || '');
      }

      const payload = {
        name: formData.name,
        bank_name: formData.bank_name,
        account_number: formData.account_number || null,
        agency_number: formData.agency_number || null,
        account_type: formData.account_type,
        initial_balance: formData.initial_balance,
        current_balance: editingAccount ? editingAccount.current_balance : formData.initial_balance,
        is_active: formData.is_active,
        is_default: formData.is_default,
        notes: formData.notes || null
      };

      if (editingAccount) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(payload)
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast.success('Conta atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert(payload);

        if (error) throw error;
        toast.success('Conta criada com sucesso');
      }

      setDialogOpen(false);
      resetForm();
      refetchAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      toast.error('Erro ao salvar conta bancária');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Conta excluída com sucesso');
      refetchAccounts();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      toast.error('Erro ao excluir conta bancária');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      corrente: 'Conta Corrente',
      poupanca: 'Poupança',
      investimento: 'Investimento',
      caixa: 'Caixa'
    };
    return types[type] || type;
  };

  const totalBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas e saldos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
              <DialogDescription>
                Cadastre uma conta bancária ou caixa para controle financeiro
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Conta Principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco *</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency_number">Agência</Label>
                  <Input
                    id="agency_number"
                    value={formData.agency_number}
                    onChange={(e) => setFormData({ ...formData, agency_number: e.target.value })}
                    placeholder="0001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Conta</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="12345-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                      <SelectItem value="caixa">Caixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_balance">Saldo Inicial</Label>
                <Input
                  id="initial_balance"
                  type="number"
                  step="0.01"
                  value={formData.initial_balance}
                  onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionais..."
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Conta Ativa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                  />
                  <Label htmlFor="is_default">Conta Padrão</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAccount ? 'Salvar' : 'Criar Conta'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {accounts.filter(a => a.is_active).length} contas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Bancárias</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(accounts.filter(a => a.is_active && a.account_type !== 'caixa').reduce((sum, a) => sum + a.current_balance, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Em contas bancárias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Caixa</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(accounts.filter(a => a.is_active && a.account_type === 'caixa').reduce((sum, a) => sum + a.current_balance, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Em caixa físico
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Contas */}
      <Card>
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
          <CardDescription>Gerencie suas contas bancárias e caixas</CardDescription>
        </CardHeader>
        <CardContent>
          {showLoader ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Agência/Conta</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {account.name}
                        {account.is_default && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{account.bank_name}</TableCell>
                    <TableCell>{getAccountTypeLabel(account.account_type)}</TableCell>
                    <TableCell>
                      {account.agency_number && account.account_number
                        ? `${account.agency_number} / ${account.account_number}`
                        : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(account.current_balance)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"}>
                        {account.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(account)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(account.id)}
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

export default ContasBancarias;
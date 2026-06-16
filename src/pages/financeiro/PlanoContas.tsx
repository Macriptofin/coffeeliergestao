import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, BookOpen, Edit, Trash2, ChevronRight, Layers, FileText } from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface Account {
  id:           string;
  code:         string;
  name:         string;
  account_type: string;
  level:        number;
  is_active:    boolean;
  is_postable:  boolean;
  parent_id?:   string;
  parent?:      { name: string; code: string };
}

const ACCOUNT_TYPES = [
  { value: 'Ativo',             label: 'Ativo',              color: 'bg-blue-100 text-blue-800' },
  { value: 'Passivo',           label: 'Passivo',            color: 'bg-red-100 text-red-800' },
  { value: 'Patrimônio Líquido',label: 'Patrimônio Líquido', color: 'bg-purple-100 text-purple-800' },
  { value: 'Receitas',          label: 'Receitas',           color: 'bg-green-100 text-green-800' },
  { value: 'Despesas',          label: 'Despesas',           color: 'bg-orange-100 text-orange-800' },
];

const typeColor = (type: string) =>
  ACCOUNT_TYPES.find(t => t.value === type)?.color || 'bg-muted text-muted-foreground';

const EMPTY_ACCOUNTS: Account[] = [];

async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*, parent:parent_id(name, code)')
    .order('code');
  if (error) throw error;
  return data || [];
}

const PlanoContas = () => {
  const queryClient = useQueryClient();

  const {
    data: accounts = EMPTY_ACCOUNTS,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: fetchAccounts });

  const refetchAccounts = () => queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });

  const [searchTerm,   setSearchTerm]   = useState("");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [editingAcc,   setEditingAcc]   = useState<Account | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingAcc,  setDeletingAcc]  = useState<Account | null>(null);

  const [form, setForm] = useState({
    code:         "",
    name:         "",
    account_type: "Despesas",
    parent_id:    "",
    is_postable:  true,
    is_active:    true,
  });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar plano de contas');
  }, [isError]);

  const openNew = () => {
    setEditingAcc(null);
    setForm({ code: '', name: '', account_type: 'Despesas', parent_id: '', is_postable: true, is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAcc(acc);
    setForm({
      code:         acc.code,
      name:         acc.name,
      account_type: acc.account_type,
      parent_id:    acc.parent_id || '',
      is_postable:  acc.is_postable,
      is_active:    acc.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { toast.error('Código e nome são obrigatórios'); return; }

    try {
      // Calcular nível automaticamente
      const level = form.parent_id
        ? (accounts.find(a => a.id === form.parent_id)?.level || 0) + 1
        : 1;

      const payload = {
        code:         form.code,
        name:         form.name,
        account_type: form.account_type,
        parent_id:    form.parent_id || null,
        is_postable:  form.is_postable,
        is_active:    form.is_active,
        level,
      };

      if (editingAcc) {
        const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', editingAcc.id);
        if (error) throw error;
        // Se agora tem filhos, marcar como sintética
        await updatePostableFlags();
        toast.success('Conta atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('chart_of_accounts').insert(payload);
        if (error) throw error;
        // Se tem pai, marcar pai como sintética
        if (form.parent_id) {
          await supabase.from('chart_of_accounts').update({ is_postable: false }).eq('id', form.parent_id);
        }
        toast.success('Conta criada com sucesso!');
      }

      setDialogOpen(false);
      refetchAccounts();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
  };

  const updatePostableFlags = async () => {
    // Recalcula: quem tem filhos = sintética, quem não tem = analítica
    const { data } = await supabase.from('chart_of_accounts').select('id, parent_id');
    if (!data) return;
    const withChildren = new Set(data.filter(a => a.parent_id).map(a => a.parent_id));
    for (const acc of data) {
      await supabase.from('chart_of_accounts')
        .update({ is_postable: !withChildren.has(acc.id) })
        .eq('id', acc.id);
    }
  };

  const handleDelete = async () => {
    if (!deletingAcc) return;
    const hasChildren = accounts.some(a => a.parent_id === deletingAcc.id);
    if (hasChildren) {
      toast.error('Não é possível excluir uma conta que possui subcontas');
      setDeleteDialog(false);
      return;
    }
    try {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('id', deletingAcc.id);
      if (error) throw error;
      toast.success('Conta excluída');
      setDeleteDialog(false);
      refetchAccounts();
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + e.message);
    }
  };

  const handleToggleActive = async (acc: Account) => {
    await supabase.from('chart_of_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id);
    refetchAccounts();
  };

  // Filtrar
  const filtered = accounts.filter(a => {
    const matchSearch = !searchTerm ||
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.includes(searchTerm);
    const matchType = typeFilter === 'all' || a.account_type === typeFilter;
    return matchSearch && matchType;
  });

  // Contas que podem ser pai (sintéticas ou nível 1-2)
  const parentOptions = accounts.filter(a => a.level <= 3);

  const analíticas  = accounts.filter(a => a.is_postable && a.is_active).length;
  const sinteticas  = accounts.filter(a => !a.is_postable && a.is_active).length;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Plano de Contas</h1>
          <p className="text-muted-foreground text-sm">
            Estrutura hierárquica de classificação contábil gerencial
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Contas', value: accounts.length, icon: BookOpen, color: 'text-primary' },
          { label: 'Analíticas (lançáveis)', value: analíticas, icon: FileText, color: 'text-green-600' },
          { label: 'Sintéticas (grupos)', value: sinteticas, icon: Layers, color: 'text-blue-600' },
          { label: 'Inativas', value: accounts.filter(a => !a.is_active).length, icon: BookOpen, color: 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-soft">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <CardTitle className="text-base">Contas — {filtered.length} encontrada(s)</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou nome..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 w-56 h-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="divide-y">
              {/* Cabeçalho */}
              <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2 bg-muted">
                <span className="col-span-2">Código</span>
                <span className="col-span-4">Nome</span>
                <span className="col-span-2">Tipo</span>
                <span className="col-span-2">Natureza</span>
                <span className="col-span-1 text-center">Status</span>
                <span className="col-span-1 text-right">Ações</span>
              </div>

              {filtered.map(acc => (
                <div
                  key={acc.id}
                  className={`grid grid-cols-12 items-center px-4 py-2.5 hover:bg-accent/30 transition-colors ${
                    !acc.is_active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Código com indentação por nível */}
                  <span className="col-span-2 font-mono text-sm font-medium text-primary">
                    <span style={{ marginLeft: (acc.level - 1) * 12 }}>{acc.code}</span>
                  </span>

                  {/* Nome com ícone de hierarquia */}
                  <span className="col-span-4 text-sm flex items-center gap-1">
                    {acc.level > 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" style={{ marginLeft: (acc.level - 2) * 12 }} />}
                    <span className={acc.is_postable ? '' : 'font-semibold'}>{acc.name}</span>
                  </span>

                  {/* Tipo */}
                  <span className="col-span-2">
                    <Badge className={`text-xs ${typeColor(acc.account_type)}`}>
                      {acc.account_type}
                    </Badge>
                  </span>

                  {/* Analítica / Sintética */}
                  <span className="col-span-2">
                    <Badge variant="outline" className={`text-xs ${acc.is_postable ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'}`}>
                      {acc.is_postable ? '✓ Analítica' : '⊞ Sintética'}
                    </Badge>
                  </span>

                  {/* Status toggle */}
                  <span className="col-span-1 flex justify-center">
                    <Switch
                      checked={acc.is_active}
                      onCheckedChange={() => handleToggleActive(acc)}
                      className="scale-75"
                    />
                  </span>

                  {/* Ações */}
                  <span className="col-span-1 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(acc)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { setDeletingAcc(acc); setDeleteDialog(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  Nenhuma conta encontrada
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAcc ? 'Editar Conta' : 'Nova Conta Contábil'}</DialogTitle>
            <DialogDescription>
              Contas analíticas aceitam lançamentos. Contas sintéticas são grupos que somam suas subcontas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="Ex: 5.2.4.1"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Seguir hierarquia: 5 → 5.1 → 5.1.1</p>
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Energia Elétrica"
              />
            </div>

            <div>
              <Label>Conta Pai (se for subconta)</Label>
              <Select value={form.parent_id} onValueChange={v => setForm(p => ({ ...p, parent_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta pai (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Sem pai (conta raiz)</SelectItem>
                  {parentOptions
                    .filter(a => !editingAcc || a.id !== editingAcc.id)
                    .map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium text-sm">Conta Analítica (aceita lançamentos)</div>
                <div className="text-xs text-muted-foreground">
                  Desative para contas sintéticas (grupos que somam subcontas)
                </div>
              </div>
              <Switch
                checked={form.is_postable}
                onCheckedChange={v => setForm(p => ({ ...p, is_postable: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Conta ativa</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave}>
              {editingAcc ? 'Salvar Alterações' : 'Criar Conta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a conta <strong>{deletingAcc?.code} — {deletingAcc?.name}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanoContas;

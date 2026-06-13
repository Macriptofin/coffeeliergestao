import { useState, useEffect, useMemo } from "react";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Search, DollarSign, Calendar, Receipt, CheckCircle, Pencil, Eye, Trash2, XCircle, Building2, FileText, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate, isOverdue } from "@/lib/date-utils";

interface AccountPayable {
  id: string;
  supplier_id?: string;
  suppliers?: { company_name: string };
  invoice_number?: string;
  description: string;
  document_number?: string;
  document_type?: string;
  issue_date: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  interest_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  payment_date?: string;
  cost_center_id?: string;
  cost_centers?: { name: string };
  account_id?: string;
  chart_of_accounts?: { name: string };
  notes?: string;
}

interface Supplier { id: string; company_name: string; }
interface CostCenter { id: string; name: string; code: string; }
interface Account { id: string; name: string; code: string; level?: number; is_postable?: boolean; }
interface BankAccount { id: string; name: string; bank_name: string; }

const DOCUMENT_TYPES = [
  { value: "nota_fiscal",   label: "Nota Fiscal" },
  { value: "recibo",        label: "Recibo" },
  { value: "comprovante",   label: "Comprovante" },
  { value: "sem_documento", label: "Sem Documento" },
];

const today = format(new Date(), 'yyyy-MM-dd');

const ContasPagar = () => {
  // ── data ──────────────────────────────────────────────────────────────────
  const [accounts,      setAccounts]      = useState<AccountPayable[]>([]);
  const [suppliers,     setSuppliers]     = useState<Supplier[]>([]);
  const [costCenters,   setCostCenters]   = useState<CostCenter[]>([]);
  const [chartAccounts, setChartAccounts] = useState<Account[]>([]);
  const [bankAccounts,  setBankAccounts]  = useState<BankAccount[]>([]);
  const [loading,       setLoading]       = useState(true);
  const showLoader = useDelayedLoading(loading);

  // ── filters ───────────────────────────────────────────────────────────────
  const [searchTerm,     setSearchTerm]     = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [monthQuick,     setMonthQuick]     = useState("current"); // current | last | next30 | all
  const [dateStart,      setDateStart]      = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateEnd,        setDateEnd]        = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // ── dialogs ───────────────────────────────────────────────────────────────
  const [newDialogOpen,     setNewDialogOpen]     = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen,    setEditDialogOpen]    = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen,  setDeleteDialogOpen]  = useState(false);

  const [selectedAccount, setSelectedAccount]   = useState<AccountPayable | null>(null);
  const [viewingAccount,  setViewingAccount]    = useState<AccountPayable | null>(null);
  const [deletingAccount, setDeletingAccount]   = useState<AccountPayable | null>(null);
  const [editingAccount,  setEditingAccount]    = useState<AccountPayable | null>(null);

  // ── form: nova conta / despesa ────────────────────────────────────────────
  const emptyForm = {
    supplier_id:    "",
    invoice_number: "",
    description:    "",
    document_number:"",
    document_type:  "nota_fiscal",
    issue_date:     today,
    due_date:       "",
    original_amount:"",
    discount_amount:"0",
    interest_amount:"0",
    cost_center_id: "",
    account_id:     "",
    notes:          "",
    // "já pago" option
    ja_pago:          false,
    pago_date:        today,
    pago_method:      "PIX",
    pago_bank_id:     "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // ── form: edição ──────────────────────────────────────────────────────────
  const [editFormData, setEditFormData] = useState({
    supplier_id: "", invoice_number: "", description: "", document_number: "",
    document_type: "nota_fiscal", issue_date: "", due_date: "",
    original_amount: "", discount_amount: "0", interest_amount: "0",
    cost_center_id: "", account_id: "", notes: "", status: ""
  });

  // ── form: pagamento ───────────────────────────────────────────────────────
  const [paymentData, setPaymentData] = useState({
    payment_date:      today,
    payment_method:    "PIX",
    bank_account_id:   "",
    amount:            "",
    discount_obtained: "0",
    interest_paid:     "0",
    document_number:   "",
    notes:             ""
  });

  // ── fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, suppliersRes, costCentersRes, chartRes, bankRes] = await Promise.all([
        supabase.from('accounts_payable')
          .select(`*, suppliers(company_name), cost_centers(name), chart_of_accounts(name)`)
          .order('due_date', { ascending: false }),
        supabase.from('suppliers').select('id, company_name').eq('status', 'Ativo').order('company_name'),
        supabase.from('cost_centers').select('id, name, code').eq('is_active', true).order('code'),
        supabase.from('chart_of_accounts').select('id, name, code, level, is_postable')
          .eq('is_active', true).eq('account_type', 'Despesas').order('code'),
        supabase.from('bank_accounts').select('id, name, bank_name').eq('is_active', true).order('name'),
      ]);
      if (accountsRes.error)   throw accountsRes.error;
      if (suppliersRes.error)  throw suppliersRes.error;
      setAccounts(accountsRes.data     || []);
      setSuppliers(suppliersRes.data   || []);
      setCostCenters(costCentersRes.data || []);
      setChartAccounts(chartRes.data   || []);
      setBankAccounts(bankRes.data     || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // ── helpers ───────────────────────────────────────────────────────────────
  const getEffectiveStatus = (a: AccountPayable) => {
    if (a.status === 'Pago' || a.status === 'Cancelado') return a.status;
    if (a.remaining_amount > 0 && isOverdue(a.due_date)) return 'Vencido';
    return a.status;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      Pendente:  "bg-yellow-100 text-yellow-800 border-yellow-200",
      Pago:      "bg-green-100  text-green-800  border-green-200",
      Parcial:   "bg-blue-100   text-blue-800   border-blue-200",
      Vencido:   "bg-red-100    text-red-800    border-red-200",
      Cancelado: "bg-gray-100   text-gray-600   border-gray-200",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] || map.Pendente}`}>
        {status}
      </span>
    );
  };

  const getDocTypeLabel = (v?: string) =>
    DOCUMENT_TYPES.find(d => d.value === v)?.label || "Nota Fiscal";

  // month quick → dateStart/dateEnd
  const applyMonthQuick = (quick: string) => {
    const now = new Date();
    setMonthQuick(quick);
    if (quick === "current") {
      setDateStart(format(startOfMonth(now), 'yyyy-MM-dd'));
      setDateEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (quick === "last") {
      const last = subMonths(now, 1);
      setDateStart(format(startOfMonth(last), 'yyyy-MM-dd'));
      setDateEnd(format(endOfMonth(last), 'yyyy-MM-dd'));
    } else if (quick === "next30") {
      setDateStart(today);
      setDateEnd(format(addDays(now, 30), 'yyyy-MM-dd'));
    } else {
      setDateStart("");
      setDateEnd("");
    }
  };

  // ── filtered accounts ─────────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    return accounts
      .map(a => ({ ...a, effectiveStatus: getEffectiveStatus(a) }))
      .filter(a => {
        const matchSearch =
          a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.suppliers?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (a.document_number || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchStatus   = statusFilter   === 'all' || a.effectiveStatus === statusFilter;
        const matchSupplier = supplierFilter === 'all' || a.supplier_id === supplierFilter;

        let matchDate = true;
        if (dateStart && dateEnd) {
          matchDate = a.due_date >= dateStart && a.due_date <= dateEnd;
        } else if (dateStart) {
          matchDate = a.due_date >= dateStart;
        } else if (dateEnd) {
          matchDate = a.due_date <= dateEnd;
        }

        return matchSearch && matchStatus && matchSupplier && matchDate;
      });
  }, [accounts, searchTerm, statusFilter, supplierFilter, dateStart, dateEnd]);

  // ── summary totals (from filtered set) ───────────────────────────────────
  const totalPendente = filteredAccounts
    .filter(a => a.effectiveStatus === 'Pendente' || a.effectiveStatus === 'Parcial')
    .reduce((s, a) => s + a.remaining_amount, 0);

  const totalVencido = filteredAccounts
    .filter(a => a.effectiveStatus === 'Vencido')
    .reduce((s, a) => s + a.remaining_amount, 0);

  const totalPago = filteredAccounts
    .filter(a => a.effectiveStatus === 'Pago')
    .reduce((s, a) => s + a.paid_amount, 0);

  // ── create ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const originalAmount = parseFloat(formData.original_amount);
      const discountAmount = parseFloat(formData.discount_amount) || 0;
      const interestAmount = parseFloat(formData.interest_amount) || 0;
      const isPago = formData.ja_pago;
      const remainingAmount = isPago ? 0 : originalAmount + interestAmount - discountAmount;

      const { data: newAP, error } = await supabase
        .from('accounts_payable')
        .insert([{
          supplier_id:     formData.supplier_id     || null,
          invoice_number:  formData.invoice_number  || null,
          description:     formData.description,
          document_number: formData.document_number || null,
          document_type:   formData.document_type   || 'nota_fiscal',
          issue_date:      formData.issue_date,
          due_date:        formData.due_date || formData.issue_date,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          interest_amount: interestAmount,
          paid_amount:     isPago ? originalAmount : 0,
          remaining_amount: remainingAmount,
          status:          isPago ? 'Pago' : 'Pendente',
          cost_center_id:  formData.cost_center_id  || null,
          account_id:      formData.account_id      || null,
          notes:           formData.notes           || null,
          ...(isPago ? { payment_date: formData.pago_date } : {}),
        }])
        .select()
        .single();

      if (error) throw error;

      // Se já pago, cria payment_transaction → trigger gera cash_transaction
      if (isPago && newAP) {
        const { error: ptErr } = await supabase
          .from('payment_transactions')
          .insert({
            account_payable_id: newAP.id,
            payment_date:       formData.pago_date,
            amount:             originalAmount,
            payment_method:     formData.pago_method,
            bank_account:       formData.pago_bank_id || null,
            notes:              `Pagamento no lançamento — ${getDocTypeLabel(formData.document_type)}`,
          });
        if (ptErr) console.error('Erro ao criar payment_transaction:', ptErr);
      }

      toast.success(isPago
        ? 'Despesa registrada e marcada como paga!'
        : 'Conta a pagar cadastrada com sucesso!');
      setNewDialogOpen(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cadastrar conta a pagar');
    }
  };

  // ── edit ──────────────────────────────────────────────────────────────────
  const handleEdit = (account: AccountPayable) => {
    setEditingAccount(account);
    setEditFormData({
      supplier_id:     account.supplier_id     || "",
      invoice_number:  account.invoice_number  || "",
      description:     account.description,
      document_number: account.document_number || "",
      document_type:   account.document_type   || "nota_fiscal",
      issue_date:      account.issue_date,
      due_date:        account.due_date,
      original_amount: account.original_amount.toString(),
      discount_amount: account.discount_amount.toString(),
      interest_amount: account.interest_amount.toString(),
      cost_center_id:  account.cost_center_id  || "",
      account_id:      account.account_id      || "",
      notes:           account.notes           || "",
      status:          account.status,
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
      const paidAmount     = editingAccount.paid_amount || 0;
      const newTotal       = originalAmount + interestAmount - discountAmount;
      const remainingAmount = Math.max(0, newTotal - paidAmount);

      const { error } = await supabase
        .from('accounts_payable')
        .update({
          supplier_id:     editFormData.supplier_id     || null,
          invoice_number:  editFormData.invoice_number  || null,
          description:     editFormData.description,
          document_number: editFormData.document_number || null,
          document_type:   editFormData.document_type   || null,
          issue_date:      editFormData.issue_date,
          due_date:        editFormData.due_date,
          original_amount: originalAmount,
          discount_amount: discountAmount,
          interest_amount: interestAmount,
          remaining_amount: remainingAmount,
          cost_center_id:  editFormData.cost_center_id  || null,
          account_id:      editFormData.account_id      || null,
          notes:           editFormData.notes           || null,
          status:          editFormData.status,
        })
        .eq('id', editingAccount.id);

      if (error) throw error;
      toast.success('Conta atualizada com sucesso!');
      setEditDialogOpen(false);
      setEditingAccount(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar conta a pagar');
    }
  };

  // ── payment ───────────────────────────────────────────────────────────────
  const handlePayment = (account: AccountPayable) => {
    setSelectedAccount(account);
    setPaymentData({
      payment_date:      today,
      payment_method:    'PIX',
      bank_account_id:   '',
      amount:            account.remaining_amount.toString(),
      discount_obtained: '0',
      interest_paid:     '0',
      document_number:   '',
      notes:             ''
    });
    setPaymentDialogOpen(true);
  };

  const processPayment = async () => {
    if (!selectedAccount) return;
    try {
      const paymentAmount    = parseFloat(paymentData.amount) || 0;
      const discountObtained = parseFloat(paymentData.discount_obtained) || 0;
      const interestPaid     = parseFloat(paymentData.interest_paid) || 0;

      if (paymentAmount <= 0) { toast.error('Informe um valor de pagamento válido'); return; }

      const { error: ptErr } = await supabase
        .from('payment_transactions')
        .insert({
          account_payable_id: selectedAccount.id,
          payment_date:       paymentData.payment_date,
          amount:             paymentAmount,
          payment_method:     paymentData.payment_method,
          bank_account:       paymentData.bank_account_id || null,
          document_number:    paymentData.document_number || null,
          notes:              paymentData.notes           || null,
        });
      if (ptErr) throw ptErr;

      const totalPago    = (selectedAccount.paid_amount || 0) + paymentAmount;
      const totalDevido  = selectedAccount.original_amount
                         + (selectedAccount.interest_amount || 0)
                         - (selectedAccount.discount_amount || 0)
                         + interestPaid - discountObtained;
      const saldoRestante = Math.max(0, totalDevido - totalPago);
      const novoStatus    = saldoRestante <= 0.01 ? 'Pago' : 'Parcial';

      const { error: upErr } = await supabase
        .from('accounts_payable')
        .update({
          paid_amount:      totalPago,
          remaining_amount: saldoRestante,
          status:           novoStatus,
          ...(novoStatus === 'Pago' ? { payment_date: paymentData.payment_date } : {}),
          ...(paymentData.bank_account_id ? { bank_account_id: paymentData.bank_account_id } : {}),
        })
        .eq('id', selectedAccount.id);
      if (upErr) throw upErr;

      toast.success(novoStatus === 'Pago'
        ? `Conta liquidada — ${paymentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado!`
        : `Pagamento parcial. Saldo restante: ${saldoRestante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);

      setPaymentDialogOpen(false);
      setSelectedAccount(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar pagamento');
    }
  };

  // ── cancel / delete ───────────────────────────────────────────────────────
  const handleCancel = async (account: AccountPayable) => {
    try {
      await supabase.from('accounts_payable').update({ status: 'Cancelado' }).eq('id', account.id);
      toast.success('Conta cancelada.');
      fetchData();
    } catch { toast.error('Erro ao cancelar conta'); }
  };

  const confirmDelete = async () => {
    if (!deletingAccount) return;
    try {
      await supabase.from('accounts_payable').delete().eq('id', deletingAccount.id);
      toast.success('Conta excluída.');
      setDeleteDialogOpen(false);
      setDeletingAccount(null);
      fetchData();
    } catch { toast.error('Erro ao excluir conta'); }
  };

  // ── reusable: select de conta contábil ───────────────────────────────────
  const AccountSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
      <SelectContent>
        {chartAccounts.map((a: any) => {
          const indent = ((a.level || 1) - 1) * 14;
          if (a.is_postable === false) {
            return (
              <div key={a.id} className="relative flex w-full select-none items-center py-1.5 pr-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                style={{ paddingLeft: `${indent + 8}px` }}>
                {a.code} {a.name}
              </div>
            );
          }
          return (
            <SelectItem key={a.id} value={a.id}>
              <span style={{ marginLeft: indent }}>{a.code} — {a.name}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const CostCenterSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione o centro de custo" /></SelectTrigger>
      <SelectContent>
        {costCenters.map(c => {
          const level = c.code.split('.').length;
          return (
            <SelectItem key={c.id} value={c.id}>
              <span style={{ marginLeft: (level - 1) * 16 }}>{c.code} - {c.name}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  // ── loading ───────────────────────────────────────────────────────────────
  if (showLoader) return <div className="p-6 text-muted-foreground text-sm">Carregando...</div>;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Contas a Pagar</h1>
        <p className="text-muted-foreground text-sm">Controle de fornecedores, duplicatas e despesas</p>
      </div>

      {/* ── Cards de resumo (respondem aos filtros) ── */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente / Parcial</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredAccounts.filter(a => a.effectiveStatus === 'Pendente' || a.effectiveStatus === 'Parcial').length} conta(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalVencido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredAccounts.filter(a => a.effectiveStatus === 'Vencido').length} conta(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago no período</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredAccounts.filter(a => a.effectiveStatus === 'Pago').length} conta(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total no filtro</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAccounts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">de {accounts.length} total</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filtros ── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-3">
          {/* Linha 1: busca + status + fornecedor */}
          <div className="flex flex-wrap gap-3 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por descrição, fornecedor, nota..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Parcial">Parcial</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: período rápido + datas + botões */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Vencimento:</span>

            {/* Quick selectors */}
            {[
              { v: "current", l: "Este mês" },
              { v: "last",    l: "Mês passado" },
              { v: "next30",  l: "Próx. 30 dias" },
              { v: "all",     l: "Todos" },
            ].map(q => (
              <button
                key={q.v}
                onClick={() => applyMonthQuick(q.v)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  monthQuick === q.v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                }`}
              >
                {q.l}
              </button>
            ))}

            <div className="flex gap-2 ml-2">
              <Input
                type="date"
                value={dateStart}
                onChange={e => { setDateStart(e.target.value); setMonthQuick(""); }}
                className="w-36 h-8 text-sm"
              />
              <span className="text-muted-foreground self-center">—</span>
              <Input
                type="date"
                value={dateEnd}
                onChange={e => { setDateEnd(e.target.value); setMonthQuick(""); }}
                className="w-36 h-8 text-sm"
              />
            </div>

            <div className="ml-auto flex gap-2">
              {/* Nova Despesa (sem NF) */}
              <Button variant="outline" onClick={() => {
                setFormData({ ...emptyForm, document_type: 'recibo', due_date: today });
                setNewDialogOpen(true);
              }}>
                <FileText className="mr-2 h-4 w-4" />
                Nova Despesa
              </Button>
              {/* Nova Conta (com NF) */}
              <Button onClick={() => {
                setFormData({ ...emptyForm, document_type: 'nota_fiscal' });
                setNewDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabela ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filteredAccounts.length} conta(s) encontrada(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor / Descrição</TableHead>
                <TableHead className="whitespace-nowrap">Tipo</TableHead>
                <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                <TableHead className="whitespace-nowrap">Valor</TableHead>
                <TableHead className="whitespace-nowrap">Pago</TableHead>
                <TableHead className="whitespace-nowrap">Saldo</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhuma conta encontrada com os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {filteredAccounts.map(account => (
                <>
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50 border-b-0"
                    onClick={() => { setViewingAccount(account); setDetailsDialogOpen(true); }}
                  >
                    <TableCell className="pb-0">
                      <div className="font-medium text-sm">{account.suppliers?.company_name || '—'}</div>
                    </TableCell>
                    <TableCell className="pb-0">
                      <span className="text-xs text-muted-foreground">{getDocTypeLabel(account.document_type)}</span>
                    </TableCell>
                    <TableCell className={`pb-0 text-sm whitespace-nowrap ${account.effectiveStatus === 'Vencido' ? 'text-red-600 font-medium' : ''}`}>
                      {formatLocalDate(account.due_date)}
                    </TableCell>
                    <TableCell className="pb-0 text-sm whitespace-nowrap">
                      {account.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0 text-sm whitespace-nowrap text-green-700">
                      {account.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0 text-sm whitespace-nowrap font-medium">
                      {account.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="pb-0">{getStatusBadge(account.effectiveStatus)}</TableCell>
                    <TableCell className="pb-0" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setViewingAccount(account); setDetailsDialogOpen(true); }} title="Ver"><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(account)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        {account.effectiveStatus !== 'Cancelado' && account.effectiveStatus !== 'Pago' && (
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(account)} title="Cancelar" className="text-muted-foreground hover:text-destructive">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setDeletingAccount(account); setDeleteDialogOpen(true); }} title="Excluir" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {(account.effectiveStatus === 'Pendente' || account.effectiveStatus === 'Parcial' || account.effectiveStatus === 'Vencido') && (
                          <Button size="sm" variant="outline" onClick={() => handlePayment(account)} className="ml-1 gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Pagar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {account.description && (
                    <TableRow key={`${account.id}-d`} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setViewingAccount(account); setDetailsDialogOpen(true); }}>
                      <TableCell colSpan={8} className="pt-0 pb-2.5">
                        <span className="text-xs text-muted-foreground">{account.description}</span>
                        {account.invoice_number && <span className="ml-2 text-xs text-muted-foreground/70">· {account.invoice_number}</span>}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          Dialog: Nova Conta / Nova Despesa
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.document_type === 'nota_fiscal' ? 'Nova Conta a Pagar' : 'Nova Despesa / Recibo'}
            </DialogTitle>
            <DialogDescription>
              {formData.document_type === 'nota_fiscal'
                ? 'Cadastre uma conta vinculada a uma nota fiscal'
                : 'Registre uma despesa sem nota fiscal (recibo, compra informal, etc.)'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo de documento */}
            <div>
              <Label>Tipo de Documento</Label>
              <div className="flex gap-2 mt-1.5">
                {DOCUMENT_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, document_type: dt.value }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      formData.document_type === dt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary text-muted-foreground'
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor {formData.document_type !== 'nota_fiscal' && <span className="text-muted-foreground font-normal">(opcional)</span>}</Label>
                <Select value={formData.supplier_id} onValueChange={v => setFormData(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{formData.document_type === 'nota_fiscal' ? 'Número da Nota' : 'Número do Documento'} <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  value={formData.invoice_number}
                  onChange={e => setFormData(f => ({ ...f, invoice_number: e.target.value }))}
                  placeholder={formData.document_type === 'nota_fiscal' ? 'Ex: NF-12345' : 'Ex: Recibo 001'}
                />
              </div>
            </div>

            <div>
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Compra de insumos na feira, Aluguel de espaço, etc."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input type="date" value={formData.issue_date}
                  onChange={e => setFormData(f => ({ ...f, issue_date: e.target.value }))} required />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" value={formData.due_date}
                  onChange={e => setFormData(f => ({ ...f, due_date: e.target.value }))}
                  placeholder="Deixe em branco = mesma data de emissão" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={formData.original_amount}
                  onChange={e => setFormData(f => ({ ...f, original_amount: e.target.value }))}
                  placeholder="0,00" required />
              </div>
              <div>
                <Label>Desconto</Label>
                <Input type="number" step="0.01" value={formData.discount_amount}
                  onChange={e => setFormData(f => ({ ...f, discount_amount: e.target.value }))}
                  placeholder="0,00" />
              </div>
              <div>
                <Label>Juros/Multa</Label>
                <Input type="number" step="0.01" value={formData.interest_amount}
                  onChange={e => setFormData(f => ({ ...f, interest_amount: e.target.value }))}
                  placeholder="0,00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Centro de Custo</Label>
                <CostCenterSelect value={formData.cost_center_id} onChange={v => setFormData(f => ({ ...f, cost_center_id: v }))} />
              </div>
              <div>
                <Label>Conta Contábil</Label>
                <AccountSelect value={formData.account_id} onChange={v => setFormData(f => ({ ...f, account_id: v }))} />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações adicionais" rows={2} />
            </div>

            {/* ── Já pago? ── */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ja_pago"
                  checked={formData.ja_pago}
                  onCheckedChange={v => setFormData(f => ({ ...f, ja_pago: !!v }))}
                />
                <label htmlFor="ja_pago" className="text-sm font-medium cursor-pointer">
                  Já foi pago
                </label>
                <span className="text-xs text-muted-foreground">(registra automaticamente no fluxo de caixa)</span>
              </div>

              {formData.ja_pago && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <Label className="text-xs">Data do Pagamento *</Label>
                    <Input type="date" value={formData.pago_date}
                      onChange={e => setFormData(f => ({ ...f, pago_date: e.target.value }))} required />
                  </div>
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={formData.pago_method} onValueChange={v => setFormData(f => ({ ...f, pago_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['PIX','Dinheiro','Transferência Bancária','Boleto','Cartão de Débito','Cartão de Crédito','Cheque','Depósito'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Conta Bancária</Label>
                    <Select value={formData.pago_bank_id} onValueChange={v => setFormData(f => ({ ...f, pago_bank_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">
                {formData.ja_pago ? <><CheckCircle className="h-4 w-4 mr-2" />Salvar como Pago</> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Dialog: Pagamento
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription>
              {selectedAccount?.description}
              {selectedAccount?.suppliers?.company_name && ` · ${selectedAccount.suppliers.company_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Pagamento *</Label>
                <Input type="date" value={paymentData.payment_date}
                  onChange={e => setPaymentData(p => ({ ...p, payment_date: e.target.value }))} />
              </div>
              <div>
                <Label>Forma de Pagamento *</Label>
                <Select value={paymentData.payment_method} onValueChange={v => setPaymentData(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['PIX','Transferência Bancária','Boleto','Dinheiro','Cartão de Débito','Cartão de Crédito','Cheque','Depósito'].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Conta Bancária de Débito</Label>
              <Select value={paymentData.bank_account_id} onValueChange={v => setPaymentData(p => ({ ...p, bank_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Pago *</Label>
                <Input type="number" step="0.01" value={paymentData.amount}
                  onChange={e => setPaymentData(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" />
                <p className="text-xs text-muted-foreground mt-1">
                  Saldo: {selectedAccount?.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <Label>Nº Comprovante / Transação</Label>
                <Input value={paymentData.document_number}
                  onChange={e => setPaymentData(p => ({ ...p, document_number: e.target.value }))}
                  placeholder="Ex: E1234567890" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desconto Obtido no Pagamento</Label>
                <Input type="number" step="0.01" value={paymentData.discount_obtained}
                  onChange={e => setPaymentData(p => ({ ...p, discount_obtained: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Juros / Multa por Atraso</Label>
                <Input type="number" step="0.01" value={paymentData.interest_paid}
                  onChange={e => setPaymentData(p => ({ ...p, interest_paid: e.target.value }))} placeholder="0,00" />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={paymentData.notes} onChange={e => setPaymentData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observações sobre o pagamento" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={processPayment} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Dialog: Edição
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Conta a Pagar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Documento</Label>
                <Select value={editFormData.document_type} onValueChange={v => setEditFormData(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editFormData.status} onValueChange={v => setEditFormData(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Pendente','Parcial','Pago','Vencido','Cancelado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor</Label>
                <Select value={editFormData.supplier_id} onValueChange={v => setEditFormData(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Número do Documento</Label>
                <Input value={editFormData.invoice_number}
                  onChange={e => setEditFormData(f => ({ ...f, invoice_number: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Descrição *</Label>
              <Input value={editFormData.description}
                onChange={e => setEditFormData(f => ({ ...f, description: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input type="date" value={editFormData.issue_date}
                  onChange={e => setEditFormData(f => ({ ...f, issue_date: e.target.value }))} required />
              </div>
              <div>
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={editFormData.due_date}
                  onChange={e => setEditFormData(f => ({ ...f, due_date: e.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Valor Original *</Label>
                <Input type="number" step="0.01" value={editFormData.original_amount}
                  onChange={e => setEditFormData(f => ({ ...f, original_amount: e.target.value }))} required />
              </div>
              <div>
                <Label>Desconto</Label>
                <Input type="number" step="0.01" value={editFormData.discount_amount}
                  onChange={e => setEditFormData(f => ({ ...f, discount_amount: e.target.value }))} />
              </div>
              <div>
                <Label>Juros</Label>
                <Input type="number" step="0.01" value={editFormData.interest_amount}
                  onChange={e => setEditFormData(f => ({ ...f, interest_amount: e.target.value }))} />
              </div>
            </div>

            {editingAccount && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground grid grid-cols-2 gap-2">
                <p><strong>Já pago:</strong> {editingAccount.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <p><strong>Saldo atual:</strong> {editingAccount.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Centro de Custo</Label>
                <CostCenterSelect value={editFormData.cost_center_id} onChange={v => setEditFormData(f => ({ ...f, cost_center_id: v }))} />
              </div>
              <div>
                <Label>Conta Contábil</Label>
                <AccountSelect value={editFormData.account_id} onChange={v => setEditFormData(f => ({ ...f, account_id: v }))} />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={editFormData.notes}
                onChange={e => setEditFormData(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Dialog: Detalhes
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Detalhes da Conta
            </DialogTitle>
          </DialogHeader>
          {viewingAccount && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Fornecedor</p><p className="font-medium">{viewingAccount.suppliers?.company_name || '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><div className="mt-0.5">{getStatusBadge(getEffectiveStatus(viewingAccount))}</div></div>
              </div>
              <Separator />
              <div><p className="text-muted-foreground text-xs">Descrição</p><p className="font-medium">{viewingAccount.description}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Tipo de Documento</p><p>{getDocTypeLabel(viewingAccount.document_type)}</p></div>
                <div><p className="text-muted-foreground text-xs">Nº Documento</p><p>{viewingAccount.invoice_number || viewingAccount.document_number || '—'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Emissão</p><p>{formatLocalDate(viewingAccount.issue_date)}</p></div>
                <div><p className="text-muted-foreground text-xs">Vencimento</p><p className={viewingAccount.effectiveStatus === 'Vencido' ? 'text-red-600 font-medium' : ''}>{formatLocalDate(viewingAccount.due_date)}</p></div>
              </div>
              {viewingAccount.payment_date && (
                <div><p className="text-muted-foreground text-xs">Data de Pagamento</p><p className="text-green-700 font-medium">{formatLocalDate(viewingAccount.payment_date)}</p></div>
              )}
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-muted-foreground text-xs">Valor Original</p><p className="font-semibold">{viewingAccount.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                <div><p className="text-muted-foreground text-xs">Pago</p><p className="text-green-600 font-semibold">{viewingAccount.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                <div><p className="text-muted-foreground text-xs">Saldo</p><p className="font-semibold">{viewingAccount.remaining_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Centro de Custo</p><p>{viewingAccount.cost_centers?.name || '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Conta Contábil</p><p>{viewingAccount.chart_of_accounts?.name || '—'}</p></div>
              </div>
              {viewingAccount.notes && <div><p className="text-muted-foreground text-xs">Observações</p><p>{viewingAccount.notes}</p></div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>Fechar</Button>
            <Button onClick={() => { setDetailsDialogOpen(false); if (viewingAccount) handleEdit(viewingAccount); }}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Dialog: Exclusão
      ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta a Pagar?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">Esta ação não pode ser desfeita.</p>
              <p className="font-medium text-foreground">{deletingAccount?.description}</p>
              <p className="text-sm mt-1">Valor: {deletingAccount?.original_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p className="text-sm mt-3 text-amber-600">Dica: considere cancelar a conta ao invés de excluir para manter o histórico.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContasPagar;

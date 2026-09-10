import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Wand2, Link2, Undo2, CheckCheck, Landmark, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';
import { parseOfx, readOfxFile } from '@/lib/ofx';

// Conciliação bancária: o extrato é a fonte da verdade do caixa. Importa OFX,
// casa com lançamentos existentes, sugere por regra e classifica em lote.
// Toda escrita passa pelas RPCs reconcile_* (ver migrations 20260905120000, 20260905150000 e 20260910130000).
// "Baixa de contas a receber" (baixa_receber): 1 crédito ↔ N NFs em aberto — recibo por NF, diferença rateada
// como deságio/juros, caixa vinculado à linha (lotes da Monkey, Pix que paga várias NFs).

type Kind = 'despesa' | 'receita' | 'transferencia' | 'retirada_socio' | 'aporte_socio'
  | 'emprestimo_recebido' | 'emprestimo_pago' | 'repasse' | 'ignorar' | 'baixa_receber';

const ADJ_TYPES = ['Desconto de Antecipação', 'Taxa Bancária', 'Desconto Comercial', 'Juros por Atraso', 'Multa por Atraso', 'Outros'];

const KIND_META: Record<string, { label: string; cls: string; dir?: 'Entrada' | 'Saída' }> = {
  despesa:             { label: 'Despesa',                cls: 'bg-red-100 text-red-700',         dir: 'Saída' },
  receita:             { label: 'Receita',                cls: 'bg-emerald-100 text-emerald-700', dir: 'Entrada' },
  baixa_receber:       { label: 'Baixa de contas a receber', cls: 'bg-emerald-100 text-emerald-800', dir: 'Entrada' },
  transferencia:       { label: 'Transferência',          cls: 'bg-blue-100 text-blue-700' },
  retirada_socio:      { label: 'Retirada do sócio',      cls: 'bg-purple-100 text-purple-700',   dir: 'Saída' },
  aporte_socio:        { label: 'Aporte do sócio',        cls: 'bg-purple-100 text-purple-700',   dir: 'Entrada' },
  emprestimo_recebido: { label: 'Empréstimo recebido',    cls: 'bg-amber-100 text-amber-700',     dir: 'Entrada' },
  emprestimo_pago:     { label: 'Quitação de empréstimo', cls: 'bg-amber-100 text-amber-700',     dir: 'Saída' },
  repasse:             { label: 'Repasse (terceiros)',    cls: 'bg-slate-100 text-slate-700' },
  ignorar:             { label: 'Ignorada',               cls: 'bg-muted text-muted-foreground' },
  existente:           { label: 'Já lançada',             cls: 'bg-emerald-50 text-emerald-700' },
};

interface BankAccount { id: string; name: string; bank_name: string; current_balance: number; is_active: boolean }
interface ChartAccount { id: string; code: string; name: string; account_type: string }
interface CostCenter { id: string; name: string }
interface NamedRow { id: string; name: string }
interface OpenAR {
  id: string; invoice_number: string | null; description: string | null; due_date: string | null;
  remaining_amount: number; client_id: string | null; client_name: string;
}
interface Line {
  id: string; bank_account_id: string; fitid: string; posted_date: string; amount: number;
  counterparty: string | null; description: string | null; raw_type: string | null;
  status: 'pendente' | 'conciliada' | 'ignorada'; kind: string | null;
  account_id: string | null; cost_center_id: string | null; supplier_id: string | null; client_id: string | null;
  suggested_kind: string | null; suggested_account_id: string | null; suggested_cost_center_id: string | null;
  suggested_supplier_id: string | null; suggested_client_id: string | null; suggested_transfer_bank_account_id: string | null;
  created_ap_id: string | null; created_ar_id: string | null; notes: string | null;
}

const EMPTY: Line[] = [];

export default function ConciliacaoBancaria() {
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts-recon'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('id, name, bank_name, current_balance, is_active').eq('is_active', true).order('is_default', { ascending: false });
      if (error) throw error;
      return (data || []) as BankAccount[];
    },
  });
  const [accountId, setAccountId] = useState<string>('');
  const activeAccount = accounts.find(a => a.id === (accountId || accounts[0]?.id));
  const currentAccountId = activeAccount?.id || '';

  const { data: chart = [] } = useQuery({
    queryKey: ['chart-postable'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chart_of_accounts').select('id, code, name, account_type').eq('is_postable', true).eq('is_active', true).order('code');
      if (error) throw error;
      return (data || []) as ChartAccount[];
    },
  });
  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers-recon'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_centers').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as CostCenter[];
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-recon'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, company_name').order('company_name');
      if (error) throw error;
      return ((data || []) as any[]).map(s => ({ id: s.id, name: s.company_name })) as NamedRow[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-recon'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as NamedRow[];
    },
  });

  const [statusFilter, setStatusFilter] = useState<'pendente' | 'conciliada' | 'ignorada' | 'todas'>('pendente');
  const [dirFilter, setDirFilter] = useState<'todas' | 'Entrada' | 'Saída'>('todas');
  const [search, setSearch] = useState('');

  const linesKey = ['statement-lines', currentAccountId];
  const { data: lines = EMPTY, isPending } = useQuery({
    queryKey: linesKey,
    enabled: !!currentAccountId,
    queryFn: async () => {
      // PostgREST devolve no máximo 1000 linhas por chamada — um extrato anual passa disso, então pagina.
      const PAGE = 1000;
      const all: Line[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('bank_statement_lines' as any)
          .select('*')
          .eq('bank_account_id', currentAccountId)
          .order('posted_date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = ((data as any) || []) as Line[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
      return all;
    },
  });
  // Linhas conciliadas em lote (1 crédito ↔ N recebimentos): quantos lançamentos cada linha carrega
  const { data: linkCounts = new Map<string, number>() } = useQuery({
    queryKey: ['statement-line-links', currentAccountId],
    enabled: !!currentAccountId && lines.length > 0,
    queryFn: async () => {
      const ids = lines.filter(l => l.status === 'conciliada').map(l => l.id);
      const m = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 500) {
        const { data, error } = await supabase
          .from('bank_statement_line_links' as any)
          .select('line_id')
          .in('line_id', ids.slice(i, i + 500));
        if (error) throw error;
        for (const row of (data as any[]) || []) m.set(row.line_id, (m.get(row.line_id) || 0) + 1);
      }
      return m;
    },
  });
  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: linesKey });
    queryClient.invalidateQueries({ queryKey: ['statement-line-links', currentAccountId] });
    queryClient.invalidateQueries({ queryKey: ['bank-accounts-recon'] });
  };

  const filtered = useMemo(() => lines.filter(l => {
    if (statusFilter !== 'todas' && l.status !== statusFilter) return false;
    if (dirFilter !== 'todas' && (l.amount > 0 ? 'Entrada' : 'Saída') !== dirFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(l.counterparty || '').toLowerCase().includes(s) && !(l.description || '').toLowerCase().includes(s)
        && !String(Math.abs(l.amount).toFixed(2)).includes(s)) return false;
    }
    return true;
  }), [lines, statusFilter, dirFilter, search]);

  const kpi = useMemo(() => {
    const pend = lines.filter(l => l.status === 'pendente');
    return {
      pendentes: pend.length,
      pendEntradas: pend.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0),
      pendSaidas: pend.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0),
      conciliadas: lines.filter(l => l.status === 'conciliada').length,
      ignoradas: lines.filter(l => l.status === 'ignorada').length,
      comSugestao: pend.filter(l => l.suggested_kind).length,
    };
  }, [lines]);

  // Seleção
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllFiltered = () => setSelected(new Set(filtered.filter(l => l.status === 'pendente').map(l => l.id)));

  // Importar
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ n: number; start: string | null; end: string | null; balance: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const previewImport = async (file: File) => {
    setImportFile(file);
    const text = await readOfxFile(file);
    const st = parseOfx(text);
    setImportPreview({ n: st.transactions.length, start: st.period_start, end: st.period_end, balance: st.balance });
  };
  const runImport = async () => {
    if (!importFile || !currentAccountId) return;
    setBusy(true);
    try {
      const st = parseOfx(await readOfxFile(importFile));
      const { data, error } = await (supabase.rpc as any)('reconcile_import_lines', {
        p_bank_account_id: currentAccountId, p_source: 'ofx', p_file_name: importFile.name,
        p_period_start: st.period_start, p_period_end: st.period_end, p_lines: st.transactions,
      });
      if (error) throw error;
      toast.success(`Importadas ${data.inserted} linhas (${data.skipped} já existiam).`);
      setImportOpen(false); setImportFile(null); setImportPreview(null);
      refetch();
    } catch (e: any) { toast.error(e.message || 'Falha na importação'); }
    finally { setBusy(false); }
  };

  const runAutoMatch = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('reconcile_auto_match', { p_bank_account_id: currentAccountId, p_days: 5 });
      if (error) throw error;
      toast.success(`${data.matched} linha(s) casaram com lançamentos já existentes.`);
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const runSuggest = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('reconcile_suggest', { p_bank_account_id: currentAccountId });
      if (error) throw error;
      toast.success(`${data.suggested} sugestão(ões) por regra.`);
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  // Classificar
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [cf, setCf] = useState({
    kind: 'despesa' as Kind, account_id: '', cost_center_id: '', supplier_id: '', client_id: '',
    transfer_bank_account_id: '', description: '', document_type: 'comprovante', invoice_number: '',
    competence_date: '', save_rule: false, rule_pattern: '',
  });
  // Baixa de contas a receber: seleção de NFs em aberto pra um único crédito
  const [arPick, setArPick] = useState<Set<string>>(new Set());
  const [arSearch, setArSearch] = useState('');
  const [arClient, setArClient] = useState('__all__');
  const [adjType, setAdjType] = useState('');
  const selectedLines = lines.filter(l => selected.has(l.id));
  const openClassify = (preset?: Partial<typeof cf>) => {
    const first = selectedLines[0];
    setArPick(new Set()); setArSearch(''); setArClient('__all__'); setAdjType('');
    setCf({
      kind: 'despesa', account_id: '', cost_center_id: '', supplier_id: '', client_id: '', transfer_bank_account_id: '',
      description: '', document_type: 'comprovante', invoice_number: '', competence_date: '',
      save_rule: selectedLines.length > 0, rule_pattern: first?.counterparty || '',
      ...(first && first.amount > 0 ? { kind: 'receita' as Kind } : {}),
      ...preset,
    });
    setClassifyOpen(true);
  };

  // Contas a receber em aberto (só carregadas quando a natureza "baixa_receber" está em uso)
  const { data: openReceivables = [] } = useQuery({
    queryKey: ['open-receivables-recon'],
    enabled: classifyOpen && cf.kind === 'baixa_receber',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('id, invoice_number, description, due_date, remaining_amount, client_id, clients(name)')
        .in('status', ['Pendente', 'Vencido']).gt('remaining_amount', 0)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map(r => ({
        id: r.id, invoice_number: r.invoice_number, description: r.description, due_date: r.due_date,
        remaining_amount: Number(r.remaining_amount) || 0, client_id: r.client_id, client_name: r.clients?.name || '',
      })) as OpenAR[];
    },
  });
  const settleLine = selectedLines.length === 1 && selectedLines[0].amount > 0 ? selectedLines[0] : null;
  const arClients = useMemo(() => {
    const m = new Map<string, string>();
    openReceivables.forEach(r => { if (r.client_id) m.set(r.client_id, r.client_name || '(sem nome)'); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [openReceivables]);
  const arCandidates = openReceivables.filter(r =>
    (arClient === '__all__' || r.client_id === arClient) &&
    (!arSearch || `${r.invoice_number || ''} ${r.client_name} ${r.description || ''}`.toLowerCase().includes(arSearch.toLowerCase())));
  const arGross = openReceivables.filter(r => arPick.has(r.id)).reduce((s, r) => s + r.remaining_amount, 0);
  const arDiff = settleLine ? Math.round((arGross - settleLine.amount) * 100) / 100 : 0;
  const toggleAr = (id: string) => setArPick(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Sugere o subconjunto das NFs filtradas cuja soma cobre o crédito com a menor diferença (deságio ≤ 25%)
  const suggestSubset = () => {
    if (!settleLine) return;
    const target = settleLine.amount;
    const cands = arCandidates.slice(0, 40).map(r => ({ id: r.id, v: r.remaining_amount })).sort((a, b) => b.v - a.v);
    let best: string[] | null = null; let bestDiff = Infinity; let nodes = 0;
    const maxSum = target * 1.25;
    const dfs = (i: number, sum: number, chosen: string[]) => {
      if (++nodes > 300000 || bestDiff <= 0.01) return;
      if (sum >= target - 0.01) { const d = sum - target; if (d < bestDiff) { bestDiff = d; best = [...chosen]; } return; }
      for (let j = i; j < cands.length; j++) {
        const ns = sum + cands[j].v; if (ns > maxSum) continue;
        chosen.push(cands[j].id); dfs(j + 1, ns, chosen); chosen.pop();
        if (bestDiff <= 0.01) return;
      }
    };
    dfs(0, 0, []);
    if (best) { setArPick(new Set(best)); toast.success(`Combinação sugerida: ${(best as string[]).length} conta(s), diferença ${formatCurrency(bestDiff)}.`); }
    else toast.warning('Nenhuma combinação das contas filtradas fecha com esse crédito (tolerância de 25%).');
  };

  const submitSettle = async () => {
    if (!settleLine || arPick.size === 0) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('reconcile_settle_receivables', {
        p_line_id: settleLine.id, p_ar_ids: Array.from(arPick),
        p_adjustment_type: adjType || null,
        p_receipt_method: /pix/i.test(settleLine.description || '') ? 'PIX' : 'Transferência Bancária',
      });
      if (error) throw error;
      const adj = Number(data?.adjustment || 0);
      toast.success(`${data?.receipts} conta(s) baixada(s)${adj > 0 ? ` — deságio ${formatCurrency(adj)}` : adj < 0 ? ` — juros/multa ${formatCurrency(-adj)}` : ''}.`);
      setSelected(new Set()); setClassifyOpen(false);
      refetch(); queryClient.invalidateQueries({ queryKey: ['open-receivables-recon'] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const applyClassification = async (ids: string[], kind: Kind, payload: Record<string, any>) => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('reconcile_apply', { p_line_ids: ids, p_kind: kind, p_payload: payload });
      if (error) throw error;
      const errs = (data?.errors || []) as { error: string }[];
      if (errs.length) toast.warning(`${data.applied} aplicada(s); ${errs.length} com erro: ${errs[0].error}`);
      else toast.success(`${data.applied} linha(s) classificada(s).`);
      setSelected(new Set()); setClassifyOpen(false);
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const submitClassify = () => {
    if (cf.kind === 'baixa_receber') { submitSettle(); return; }
    const payload: Record<string, any> = {};
    if (cf.account_id) payload.account_id = cf.account_id;
    if (cf.cost_center_id) payload.cost_center_id = cf.cost_center_id;
    if (cf.supplier_id) payload.supplier_id = cf.supplier_id;
    if (cf.client_id) payload.client_id = cf.client_id;
    if (cf.transfer_bank_account_id) payload.transfer_bank_account_id = cf.transfer_bank_account_id;
    if (cf.description) payload.description = cf.description;
    if (cf.document_type) payload.document_type = cf.document_type;
    if (cf.invoice_number) payload.invoice_number = cf.invoice_number;
    if (cf.competence_date) payload.competence_date = cf.competence_date;
    if (cf.save_rule && cf.rule_pattern) {
      payload.save_rule = true; payload.rule_pattern = cf.rule_pattern;
      const first = selectedLines[0];
      if (first) payload.rule_direction = first.amount > 0 ? 'Entrada' : 'Saída';
    }
    applyClassification(Array.from(selected), cf.kind, payload);
  };

  // Aplicar sugestões (uma linha ou todas as pendentes com sugestão)
  const applySuggestion = async (targets: Line[]) => {
    const groups = new Map<string, { kind: Kind; payload: Record<string, any>; ids: string[] }>();
    for (const l of targets) {
      if (!l.suggested_kind) continue;
      const key = [l.suggested_kind, l.suggested_account_id, l.suggested_cost_center_id, l.suggested_supplier_id, l.suggested_client_id, l.suggested_transfer_bank_account_id].join('|');
      if (!groups.has(key)) groups.set(key, {
        kind: l.suggested_kind as Kind,
        payload: {
          ...(l.suggested_account_id ? { account_id: l.suggested_account_id } : {}),
          ...(l.suggested_cost_center_id ? { cost_center_id: l.suggested_cost_center_id } : {}),
          ...(l.suggested_supplier_id ? { supplier_id: l.suggested_supplier_id } : {}),
          ...(l.suggested_client_id ? { client_id: l.suggested_client_id } : {}),
          ...(l.suggested_transfer_bank_account_id ? { transfer_bank_account_id: l.suggested_transfer_bank_account_id } : {}),
        },
        ids: [],
      });
      groups.get(key)!.ids.push(l.id);
    }
    setBusy(true);
    try {
      let ok = 0, bad = 0;
      for (const g of groups.values()) {
        const { data, error } = await (supabase.rpc as any)('reconcile_apply', { p_line_ids: g.ids, p_kind: g.kind, p_payload: g.payload });
        if (error) throw error;
        ok += data.applied || 0; bad += (data.errors || []).length;
      }
      toast.success(`${ok} sugestão(ões) aplicada(s)${bad ? `, ${bad} com erro` : ''}.`);
      setSelected(new Set());
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const undo = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)('reconcile_undo', { p_line_id: id });
      if (error) throw error;
      toast.success('Desfeito — linha voltou a pendente.');
      refetch();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const accName = (id: string | null) => { const a = chart.find(c => c.id === id); return a ? `${a.code} ${a.name}` : ''; };
  const kindBadge = (k: string | null) => k ? <Badge variant="outline" className={`${KIND_META[k]?.cls || ''} border-transparent`}>{KIND_META[k]?.label || k}</Badge> : null;

  const showAccountField = ['despesa', 'receita'].includes(cf.kind);
  const chartFiltered = chart.filter(c => cf.kind === 'receita' ? c.code.startsWith('4') : !c.code.startsWith('4'));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Conciliação Bancária</h1>
          <p className="text-muted-foreground">Extrato do banco × lançamentos do sistema — casa o que existe, classifica o que falta</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={currentAccountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-[220px]"><Landmark className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {a.bank_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => setImportOpen(true)} disabled={!currentAccountId}><Upload className="h-4 w-4 mr-2" />Importar extrato (OFX)</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{kpi.pendentes}</p>
          <p className="text-xs text-muted-foreground">{kpi.comSugestao} com sugestão</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entradas pendentes</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(kpi.pendEntradas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saídas pendentes</p><p className="text-2xl font-bold text-red-600">{formatCurrency(Math.abs(kpi.pendSaidas))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conciliadas / ignoradas</p><p className="text-2xl font-bold">{kpi.conciliadas} <span className="text-base text-muted-foreground">/ {kpi.ignoradas}</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo no sistema</p><p className="text-2xl font-bold">{formatCurrency(activeAccount?.current_balance || 0)}</p>
          <p className="text-xs text-muted-foreground">confira com o saldo do banco</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Linhas do extrato</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={runAutoMatch} disabled={busy || !currentAccountId}><Link2 className="h-4 w-4 mr-1" />Casar com lançamentos existentes</Button>
              <Button variant="outline" size="sm" onClick={runSuggest} disabled={busy || !currentAccountId}><Wand2 className="h-4 w-4 mr-1" />Sugerir por regras</Button>
              <Button variant="outline" size="sm" onClick={() => applySuggestion(lines.filter(l => l.status === 'pendente' && l.suggested_kind))} disabled={busy || kpi.comSugestao === 0}>
                <CheckCheck className="h-4 w-4 mr-1" />Aplicar todas as sugestões ({kpi.comSugestao})
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar contraparte, descrição ou valor…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="conciliada">Conciliadas</SelectItem>
                <SelectItem value="ignorada">Ignoradas</SelectItem><SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dirFilter} onValueChange={(v) => setDirFilter(v as any)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Entradas e saídas</SelectItem><SelectItem value="Entrada">Entradas</SelectItem><SelectItem value="Saída">Saídas</SelectItem></SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={selectAllFiltered}>Selecionar pendentes ({filtered.filter(l => l.status === 'pendente').length})</Button>
            <Button size="sm" onClick={() => openClassify()} disabled={selected.size === 0 || busy}>Classificar {selected.size > 0 ? `(${selected.size})` : ''}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPending && <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>}
          {!isPending && lines.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma linha importada nesta conta ainda. Importe o extrato OFX.</p>
          )}
          {lines.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead><TableHead>Data</TableHead><TableHead>Contraparte / descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead><TableHead>Sugestão</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.slice(0, 600).map(l => (
                    <TableRow key={l.id} className={l.status === 'pendente' ? '' : 'opacity-70'}>
                      <TableCell>{l.status === 'pendente' && <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatLocalDate(l.posted_date)}</TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="font-medium truncate">{l.counterparty || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{l.description}</div>
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap font-medium ${l.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(l.amount)}</TableCell>
                      <TableCell>
                        {l.status === 'pendente' && l.suggested_kind && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {kindBadge(l.suggested_kind)}
                            {l.suggested_account_id && <span className="text-xs text-muted-foreground">{accName(l.suggested_account_id)}</span>}
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => applySuggestion([l])} disabled={busy}>Aplicar</Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.status === 'pendente' ? <Badge variant="outline">Pendente</Badge> : (
                          <div className="flex flex-col gap-0.5" title={l.notes || undefined}>
                            {kindBadge(l.kind)}
                            {l.account_id && <span className="text-xs text-muted-foreground">{accName(l.account_id)}</span>}
                            {(linkCounts.get(l.id) || 0) > 1 && <span className="text-xs text-muted-foreground">{linkCounts.get(l.id)} lançamentos em lote</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status === 'pendente' ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelected(new Set([l.id])); setTimeout(() => openClassify(), 0); }} disabled={busy}>Classificar</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => undo(l.id)} disabled={busy}><Undo2 className="h-3 w-3 mr-1" />Desfazer</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 600 && <p className="text-xs text-muted-foreground p-2">Mostrando 600 de {filtered.length} — use a busca ou os filtros.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Importar */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!busy) setImportOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar extrato — {activeAccount?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <Input type="file" accept=".ofx,.OFX,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) previewImport(f); }} />
            {importPreview && (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <div><b>{importPreview.n}</b> transações</div>
                <div>Período: {importPreview.start ? formatLocalDate(importPreview.start) : '?'} → {importPreview.end ? formatLocalDate(importPreview.end) : '?'}</div>
                {importPreview.balance != null && <div>Saldo no extrato: <b>{formatCurrency(importPreview.balance)}</b></div>}
                <p className="text-xs text-muted-foreground">Linhas já importadas (mesmo identificador) são ignoradas — pode reimportar o mesmo período sem duplicar.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={runImport} disabled={busy || !importPreview}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Classificar */}
      <Dialog open={classifyOpen} onOpenChange={(o) => { if (!busy) setClassifyOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Classificar {selected.size} linha(s)</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            {selectedLines.length > 0 && (
              <div className="rounded-lg border p-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                {selectedLines.slice(0, 6).map(l => <div key={l.id}>{formatLocalDate(l.posted_date)} · {l.counterparty} · <b className={l.amount > 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(l.amount)}</b></div>)}
                {selectedLines.length > 6 && <div>… e mais {selectedLines.length - 6}</div>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Natureza</Label>
              <Select value={cf.kind} onValueChange={(v) => setCf(f => ({ ...f, kind: v as Kind, account_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_META) as string[]).filter(k => k !== 'existente').map(k => <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showAccountField && (
              <div className="space-y-1.5">
                <Label>Conta contábil {cf.kind === 'despesa' ? '*' : '(padrão: 4.1.1 Receita de Eventos)'}</Label>
                <Select value={cf.account_id} onValueChange={(v) => setCf(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="max-h-72">{chartFiltered.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {cf.kind === 'despesa' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Centro de custo</Label>
                  <Select value={cf.cost_center_id} onValueChange={(v) => setCf(f => ({ ...f, cost_center_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fornecedor (opcional)</Label>
                  <Select value={cf.supplier_id} onValueChange={(v) => setCf(f => ({ ...f, supplier_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {cf.kind === 'receita' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cliente (opcional)</Label>
                  <Select value={cf.client_id} onValueChange={(v) => setCf(f => ({ ...f, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº da NF (opcional)</Label>
                  <Input value={cf.invoice_number} onChange={e => setCf(f => ({ ...f, invoice_number: e.target.value }))} />
                </div>
              </div>
            )}
            {cf.kind === 'baixa_receber' && (!settleLine ? (
              <p className="text-xs text-destructive">Selecione uma única linha de crédito (entrada) para baixar contas a receber.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Escolha as NFs que este crédito paga. Cada conta é baixada pelo saldo em aberto; se a soma for maior que o crédito, a diferença é rateada como deságio (antecipação) — se for menor, como juros/multa recebidos. Baixa parcial de uma NF não é feita aqui (use Contas a Receber → Receber).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={arClient} onValueChange={setArClient}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__all__">Todos os clientes</SelectItem>
                      {arClients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Buscar NF / cliente / descrição" value={arSearch} onChange={e => setArSearch(e.target.value)} />
                </div>
                <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
                  {arCandidates.slice(0, 200).map(r => (
                    <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={arPick.has(r.id)} onCheckedChange={() => toggleAr(r.id)} />
                      <span className="w-24 font-medium truncate">{r.invoice_number || '—'}</span>
                      <span className="flex-1 truncate">{r.client_name}{r.description ? ` · ${r.description}` : ''}</span>
                      <span className="w-20 text-muted-foreground whitespace-nowrap">{r.due_date ? formatLocalDate(r.due_date) : ''}</span>
                      <span className="w-24 text-right font-medium whitespace-nowrap">{formatCurrency(r.remaining_amount)}</span>
                    </label>
                  ))}
                  {arCandidates.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhuma conta a receber em aberto com esse filtro.</div>}
                  {arCandidates.length > 200 && <div className="p-2 text-xs text-muted-foreground">Mostrando 200 — refine a busca.</div>}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={suggestSubset} disabled={busy || arCandidates.length === 0}>Sugerir combinação</Button>
                  <div className="text-right">
                    <div>Selecionado: <b>{formatCurrency(arGross)}</b> ({arPick.size}) · Crédito: <b>{formatCurrency(settleLine.amount)}</b></div>
                    {arPick.size > 0 && (
                      <div className={Math.abs(arDiff) < 0.005 ? 'text-emerald-600' : arDiff > 0 ? 'text-amber-600' : 'text-blue-600'}>
                        {Math.abs(arDiff) < 0.005 ? 'Fecha exato'
                          : arDiff > 0 ? `Deságio/desconto: ${formatCurrency(arDiff)} (${arGross > 0 ? (arDiff / arGross * 100).toFixed(2) : '0'}%)`
                          : `Juros/multa recebidos: ${formatCurrency(-arDiff)}`}
                        {Math.abs(arDiff) > arGross * 0.25 && ' — acima de 25%, confira a seleção'}
                      </div>
                    )}
                  </div>
                </div>
                {arPick.size > 0 && Math.abs(arDiff) >= 0.005 && (
                  <div className="space-y-1.5">
                    <Label>Classificação da diferença</Label>
                    <Select value={adjType || (arDiff > 0 ? 'Desconto de Antecipação' : 'Juros por Atraso')} onValueChange={setAdjType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ADJ_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Deságio de antecipação e taxa bancária entram no DRE como despesa financeira; desconto comercial como dedução da receita; juros/multa como receita financeira.</p>
                  </div>
                )}
              </div>
            ))}
            {cf.kind === 'transferencia' && (
              <div className="space-y-1.5">
                <Label>Conta de destino/origem</Label>
                <Select value={cf.transfer_bank_account_id} onValueChange={(v) => setCf(f => ({ ...f, transfer_bank_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Outra conta" /></SelectTrigger>
                  <SelectContent>{accounts.filter(a => a.id !== currentAccountId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">A linha correspondente na outra conta (mesmo valor, ±3 dias) é conciliada junto.</p>
              </div>
            )}
            {['despesa', 'receita'].includes(cf.kind) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Competência (opcional)</Label>
                  <Input type="date" value={cf.competence_date} onChange={e => setCf(f => ({ ...f, competence_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição (opcional)</Label>
                  <Input value={cf.description} onChange={e => setCf(f => ({ ...f, description: e.target.value }))} placeholder="padrão: contraparte" />
                </div>
              </div>
            )}
            {!['despesa', 'receita', 'transferencia', 'ignorar', 'baixa_receber'].includes(cf.kind) && (
              <p className="text-xs text-muted-foreground">
                Vai pro caixa com a conta patrimonial padrão ({cf.kind.startsWith('retirada') ? '3.2 Retiradas do Sócio' : cf.kind.startsWith('aporte') ? '3.3 Aportes do Sócio' : cf.kind.startsWith('emprestimo') ? '2.1.1 Empréstimos de Terceiros' : '2.1.2 Valores de Terceiros'}) — não entra no DRE.
              </p>
            )}
            {!['ignorar', 'baixa_receber'].includes(cf.kind) && (
              <div className="rounded-lg border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={cf.save_rule} onCheckedChange={(v) => setCf(f => ({ ...f, save_rule: !!v }))} />
                  Salvar como regra — próximas linhas desta contraparte vêm sugeridas
                </label>
                {cf.save_rule && <Input value={cf.rule_pattern} onChange={e => setCf(f => ({ ...f, rule_pattern: e.target.value }))} placeholder="Trecho da contraparte (ex.: STOK CENTER)" />}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassifyOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitClassify} disabled={busy || (cf.kind === 'despesa' && !cf.account_id) || (cf.kind === 'transferencia' && !cf.transfer_bank_account_id)
              || (cf.kind === 'baixa_receber' && (!settleLine || arPick.size === 0 || Math.abs(arDiff) > arGross * 0.25))}>
              {cf.kind === 'baixa_receber' ? `Baixar ${arPick.size} conta(s)` : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

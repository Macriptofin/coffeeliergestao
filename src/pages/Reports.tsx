import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, DollarSign, Package, Users,
  Calendar, BarChart3, ShoppingCart, AlertTriangle, Loader2,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ComercialData {
  faturamentoMes:      number;
  faturamentoAnterior: number;
  ticketMedio:         number;
  propostas:           number;
  propostasAprovadas:  number;
  eventosMes:          number;
  totalPessoas:        number;
  topClientes:         { nome: string; total: number; eventos: number }[];
}

interface EstoqueData {
  totalValor:   number;
  totalItens:   number;
  abaixoMinimo: number;
  zerados:      number;
  curvaABC:     { material: string; valor: number; classe: 'A'|'B'|'C'; percent: number }[];
}

interface ProducaoData {
  totalFichas:      number;
  fichasComplete:   number;
  fichasIncomplete: number;
  topFichas:        { nome: string; custo: number; categoria: string }[];
  custoMedioOP:     number;
}

interface ComprasData {
  totalMes:          number;
  totalAnterior:     number;
  topFornecedores:   { nome: string; total: number; nfs: number }[];
  itensMaisCostosos: { material: string; custo_medio: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt   = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const Variation = ({ value }: { value: number }) => {
  if (Math.abs(value) < 0.01)
    return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0%</span>;
  const up = value > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}% vs mês anterior
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="p-4 bg-muted rounded-full mb-3">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <p className="font-medium text-muted-foreground">{title}</p>
    <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">{desc}</p>
  </div>
);

// ─── Componente Principal ──────────────────────────────────────────────────────

const Reports = () => {
  const [year,  setYear]  = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [tab,   setTab]   = useState('comercial');

  const [comercial, setComercial] = useState<ComercialData | null>(null);
  const [estoque,   setEstoque]   = useState<EstoqueData | null>(null);
  const [producao,  setProducao]  = useState<ProducaoData | null>(null);
  const [compras,   setCompras]   = useState<ComprasData | null>(null);
  const [loading,   setLoading]   = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  useEffect(() => { loadTab(); }, [year, month, tab]);

  const dateRange = () => {
    const y = parseInt(year), m = parseInt(month);
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const end   = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const pstart = `${py}-${String(pm).padStart(2,'0')}-01`;
    const pend   = `${py}-${String(pm).padStart(2,'0')}-${new Date(py, pm, 0).getDate()}`;
    return { start, end, pstart, pend };
  };

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'comercial') await loadComercial();
      if (tab === 'estoque')   await loadEstoque();
      if (tab === 'producao')  await loadProducao();
      if (tab === 'compras')   await loadCompras();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Comercial ──────────────────────────────────────────────────────────────
  const loadComercial = async () => {
    const { start, end, pstart, pend } = dateRange();
    const [arRes, arPrev, propRes, evtRes, clientRes] = await Promise.all([
      supabase.from('accounts_receivable').select('original_amount').gte('issue_date', start).lte('issue_date', end),
      supabase.from('accounts_receivable').select('original_amount').gte('issue_date', pstart).lte('issue_date', pend),
      supabase.from('proposals').select('id, status').gte('created_at', start).lte('created_at', end),
      supabase.from('events').select('id, total_people').gte('event_date', start).lte('event_date', end),
      supabase.from('accounts_receivable').select('original_amount, clients(name)').gte('issue_date', start).lte('issue_date', end),
    ]);

    const fat     = (arRes.data  || []).reduce((s, r) => s + parseFloat(r.original_amount || '0'), 0);
    const fatPrev = (arPrev.data || []).reduce((s, r) => s + parseFloat(r.original_amount || '0'), 0);
    const props   = propRes.data || [];
    const evts    = evtRes.data  || [];

    const clientMap: Record<string, { total: number; eventos: number }> = {};
    (clientRes.data || []).forEach((r: any) => {
      const nome = r.clients?.name || 'Sem cliente';
      if (!clientMap[nome]) clientMap[nome] = { total: 0, eventos: 0 };
      clientMap[nome].total   += parseFloat(r.original_amount || '0');
      clientMap[nome].eventos += 1;
    });

    setComercial({
      faturamentoMes:      fat,
      faturamentoAnterior: fatPrev,
      ticketMedio:         evts.length > 0 ? fat / evts.length : 0,
      propostas:           props.length,
      propostasAprovadas:  props.filter(p => p.status === 'aprovada').length,
      eventosMes:          evts.length,
      totalPessoas:        evts.reduce((s, e) => s + (e.total_people || 0), 0),
      topClientes:         Object.entries(clientMap).map(([nome, d]) => ({ nome, ...d })).sort((a,b) => b.total - a.total).slice(0,5),
    });
  };

  // ── Estoque / Curva ABC ────────────────────────────────────────────────────
  const loadEstoque = async () => {
    const [stockRes, alertRes] = await Promise.all([
      supabase.from('stock_items').select('material_id, total_value, minimum_quantity, current_quantity, materials!material_id(name)'),
      supabase.from('vw_stock_available').select('status_estoque').limit(500),
    ]);

    const items      = stockRes.data || [];
    const totalValor = items.reduce((s, i) => s + parseFloat(i.total_value || '0'), 0);
    const alerts     = alertRes.data || [];

    const sorted = [...items]
      .filter(i => parseFloat(i.total_value || '0') > 0)
      .sort((a, b) => parseFloat(b.total_value || '0') - parseFloat(a.total_value || '0'));

    let acum = 0;
    const curvaABC = sorted.slice(0, 20).map(i => {
      const val = parseFloat(i.total_value || '0');
      const p   = totalValor > 0 ? (val / totalValor) * 100 : 0;
      acum += p;
      return {
        material: (i.materials as any)?.name || '—',
        valor:    val,
        percent:  p,
        classe:   (acum <= 70 ? 'A' : acum <= 90 ? 'B' : 'C') as 'A'|'B'|'C',
      };
    });

    setEstoque({
      totalValor,
      totalItens:   items.length,
      abaixoMinimo: alerts.filter((a: any) => ['critico','baixo'].includes(a.status_estoque)).length,
      zerados:      alerts.filter((a: any) => a.status_estoque === 'zerado').length,
      curvaABC,
    });
  };

  // ── Produção ───────────────────────────────────────────────────────────────
  const loadProducao = async () => {
    const [bomsRes, ordRes] = await Promise.all([
      supabase.from('recipes_bom').select('cached_total_cost, cost_status, materials!finished_material_id(name, category)').eq('is_archived', false).order('cached_total_cost', { ascending: false }),
      supabase.from('bom_production_orders').select('total_cost').eq('status', 'Concluído'),
    ]);

    const boms = bomsRes.data || [];
    const ords = ordRes.data  || [];
    const custoTotal = ords.reduce((s, o) => s + parseFloat(o.total_cost || '0'), 0);

    setProducao({
      totalFichas:      boms.length,
      fichasComplete:   boms.filter(b => b.cost_status === 'complete').length,
      fichasIncomplete: boms.filter(b => b.cost_status !== 'complete').length,
      topFichas:        boms.slice(0, 10).map(b => ({
        nome:      (b.materials as any)?.name || '—',
        custo:     parseFloat(b.cached_total_cost || '0'),
        categoria: (b.materials as any)?.category || '—',
      })),
      custoMedioOP: ords.length > 0 ? custoTotal / ords.length : 0,
    });
  };

  // ── Compras ────────────────────────────────────────────────────────────────
  const loadCompras = async () => {
    const { start, end, pstart, pend } = dateRange();
    const [invRes, invPrev, supRes, stockRes] = await Promise.all([
      supabase.from('purchase_invoices').select('total_amount').gte('invoice_date', start).lte('invoice_date', end).eq('stock_posted', true),
      supabase.from('purchase_invoices').select('total_amount').gte('invoice_date', pstart).lte('invoice_date', pend).eq('stock_posted', true),
      supabase.from('purchase_invoices').select('total_amount, suppliers(company_name)').gte('invoice_date', start).lte('invoice_date', end).eq('stock_posted', true),
      supabase.from('stock_items').select('average_price, materials!material_id(name)').gt('average_price', 0).order('average_price', { ascending: false }).limit(10),
    ]);

    const total     = (invRes.data  || []).reduce((s, r) => s + parseFloat(r.total_amount || '0'), 0);
    const totalPrev = (invPrev.data || []).reduce((s, r) => s + parseFloat(r.total_amount || '0'), 0);

    const supMap: Record<string, { total: number; nfs: number }> = {};
    (supRes.data || []).forEach((r: any) => {
      const nome = r.suppliers?.company_name || 'Sem fornecedor';
      if (!supMap[nome]) supMap[nome] = { total: 0, nfs: 0 };
      supMap[nome].total += parseFloat(r.total_amount || '0');
      supMap[nome].nfs   += 1;
    });

    setCompras({
      totalMes:          total,
      totalAnterior:     totalPrev,
      topFornecedores:   Object.entries(supMap).map(([nome, d]) => ({ nome, ...d })).sort((a,b) => b.total - a.total).slice(0, 5),
      itensMaisCostosos: (stockRes.data || []).map((s: any) => ({
        material:   s.materials?.name || '—',
        custo_medio: parseFloat(s.average_price || '0'),
      })),
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const varFat  = comercial && comercial.faturamentoAnterior > 0
    ? ((comercial.faturamentoMes - comercial.faturamentoAnterior) / comercial.faturamentoAnterior) * 100 : 0;
  const varComp = compras && compras.totalAnterior > 0
    ? ((compras.totalMes - compras.totalAnterior) / compras.totalAnterior) * 100 : 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Relatórios</h1>
          <p className="text-muted-foreground text-sm">
            Análises executivas — {MONTHS[parseInt(month)-1]} de {year}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comercial"><TrendingUp className="h-4 w-4 mr-1.5" />Comercial</TabsTrigger>
          <TabsTrigger value="estoque"><Package className="h-4 w-4 mr-1.5" />Estoque</TabsTrigger>
          <TabsTrigger value="producao"><BarChart3 className="h-4 w-4 mr-1.5" />Produção</TabsTrigger>
          <TabsTrigger value="compras"><ShoppingCart className="h-4 w-4 mr-1.5" />Compras</TabsTrigger>
        </TabsList>

        {/* ═══ COMERCIAL ═══════════════════════════════════════════════════ */}
        <TabsContent value="comercial" className="mt-6 space-y-6">
          {loading
            ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : comercial ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:'Faturamento', value: fmt(comercial.faturamentoMes), extra: <Variation value={varFat} />, icon: DollarSign, color:'text-green-700' },
                  { label:'Ticket Médio', value: fmt(comercial.ticketMedio), extra: <span className="text-xs text-muted-foreground">por evento</span>, icon: TrendingUp, color:'text-blue-700' },
                  { label:'Eventos', value: String(comercial.eventosMes), extra: <span className="text-xs text-muted-foreground">{comercial.totalPessoas} pessoas atendidas</span>, icon: Calendar, color:'text-primary' },
                  { label:'Propostas', value: String(comercial.propostas), extra: <span className="text-xs text-muted-foreground">{comercial.propostasAprovadas} aprovadas</span>, icon: Users, color:'text-purple-600' },
                ].map(({ label, value, extra, icon: Icon, color }) => (
                  <Card key={label} className="shadow-soft">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      {extra}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Clientes</CardTitle>
                    <CardDescription>Por faturamento no período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comercial.topClientes.length === 0
                      ? <EmptyState icon={Users} title="Nenhum faturamento no período" desc="Lance contas a receber no módulo Financeiro." />
                      : <div className="space-y-2">
                          {comercial.topClientes.map((c, i) => (
                            <div key={c.nome} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{c.nome}</p>
                                  <p className="text-xs text-muted-foreground">{c.eventos} {c.eventos===1?'evento':'eventos'}</p>
                                </div>
                              </div>
                              <span className="font-bold text-sm">{fmt(c.total)}</span>
                            </div>
                          ))}
                        </div>
                    }
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Taxa de Conversão</CardTitle>
                    <CardDescription>Propostas criadas vs aprovadas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {comercial.propostas === 0
                      ? <EmptyState icon={TrendingUp} title="Nenhuma proposta no período" desc="Crie propostas no módulo Vendas." />
                      : <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Aprovadas</span>
                              <span className="font-semibold">{comercial.propostasAprovadas} / {comercial.propostas}</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full"
                                style={{ width:`${comercial.propostas>0?(comercial.propostasAprovadas/comercial.propostas)*100:0}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {comercial.propostas>0?((comercial.propostasAprovadas/comercial.propostas)*100).toFixed(0):0}% de conversão
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Faturamento anterior</p>
                              <p className="font-bold mt-1">{fmt(comercial.faturamentoAnterior)}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Variação</p>
                              <p className="font-bold mt-1"><Variation value={varFat} /></p>
                            </div>
                          </div>
                        </div>
                    }
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ═══ ESTOQUE ═════════════════════════════════════════════════════ */}
        <TabsContent value="estoque" className="mt-6 space-y-6">
          {loading
            ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : estoque ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:'Valor Total em Estoque', value: fmt(estoque.totalValor), sub:`${estoque.totalItens} materiais`, color:'text-primary' },
                  { label:'Abaixo do Mínimo', value: String(estoque.abaixoMinimo), sub:'requer reposição', color: estoque.abaixoMinimo>0?'text-yellow-600':'text-green-600' },
                  { label:'Estoque Zerado', value: String(estoque.zerados), sub:'sem unidades', color: estoque.zerados>0?'text-red-600':'text-green-600' },
                  { label:'Itens Classe A', value: String(estoque.curvaABC.filter(i=>i.classe==='A').length), sub:'70% do valor total', color:'text-blue-600' },
                ].map(({ label, value, sub, color }) => (
                  <Card key={label} className="shadow-soft">
                    <CardContent className="pt-5 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <span className="text-xs text-muted-foreground">{sub}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Curva ABC de Materiais</CardTitle>
                  <CardDescription>Classe A = 70% do valor · Classe B = 20% · Classe C = 10%</CardDescription>
                </CardHeader>
                <CardContent>
                  {estoque.curvaABC.length === 0
                    ? <EmptyState icon={Package} title="Nenhum item com valor em estoque" desc="Lance notas fiscais de compra para formar o estoque." />
                    : <div className="space-y-1.5">
                        <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 bg-muted rounded-lg">
                          <span className="col-span-1">Cl.</span>
                          <span className="col-span-6">Material</span>
                          <span className="col-span-3 text-right">Valor</span>
                          <span className="col-span-2 text-right">%</span>
                        </div>
                        {estoque.curvaABC.map((item, i) => (
                          <div key={i} className="grid grid-cols-12 items-center px-3 py-2.5 border rounded-lg text-sm">
                            <span className="col-span-1">
                              <Badge className={
                                item.classe==='A'?'bg-green-100 text-green-800 border-green-200 text-xs':
                                item.classe==='B'?'bg-blue-100 text-blue-800 border-blue-200 text-xs':
                                'bg-muted text-muted-foreground text-xs'
                              }>{item.classe}</Badge>
                            </span>
                            <span className="col-span-6 font-medium truncate">{item.material}</span>
                            <span className="col-span-3 text-right font-semibold">{fmt(item.valor)}</span>
                            <span className="col-span-2 text-right text-muted-foreground">{item.percent.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                  }
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ═══ PRODUÇÃO ════════════════════════════════════════════════════ */}
        <TabsContent value="producao" className="mt-6 space-y-6">
          {loading
            ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : producao ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:'Fichas Técnicas', value: String(producao.totalFichas), sub:'total ativas', color:'text-primary' },
                  { label:'Custo completo', value: String(producao.fichasComplete), sub:'prontas para orçar', color:'text-green-600' },
                  { label:'Custo incompleto', value: String(producao.fichasIncomplete), sub:'requer revisão', color: producao.fichasIncomplete>0?'text-yellow-600':'text-green-600' },
                  { label:'Custo médio por OP', value: fmt(producao.custoMedioOP), sub:'ordens concluídas', color:'text-blue-600' },
                ].map(({ label, value, sub, color }) => (
                  <Card key={label} className="shadow-soft">
                    <CardContent className="pt-5 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <span className="text-xs text-muted-foreground">{sub}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Fichas Técnicas por Custo</CardTitle>
                  <CardDescription>Top 10 produtos acabados — custo do lote (BOM)</CardDescription>
                </CardHeader>
                <CardContent>
                  {producao.topFichas.length === 0
                    ? <EmptyState icon={BarChart3} title="Nenhuma ficha técnica" desc="Crie fichas técnicas no módulo Produção." />
                    : <div className="space-y-2">
                        {producao.topFichas.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{f.nome}</p>
                                <p className="text-xs text-muted-foreground">{f.categoria}</p>
                              </div>
                            </div>
                            <span className="font-bold text-sm flex-shrink-0">{fmt(f.custo)}</span>
                          </div>
                        ))}
                      </div>
                  }
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ═══ COMPRAS ═════════════════════════════════════════════════════ */}
        <TabsContent value="compras" className="mt-6 space-y-6">
          {loading
            ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : compras ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-soft">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Total de Compras</span>
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-xl font-bold">{fmt(compras.totalMes)}</div>
                    <Variation value={varComp} />
                  </CardContent>
                </Card>
                <Card className="shadow-soft">
                  <CardContent className="pt-5 pb-4">
                    <div className="text-xs text-muted-foreground mb-1">Mês anterior</div>
                    <div className="text-xl font-bold text-muted-foreground">{fmt(compras.totalAnterior)}</div>
                    <span className="text-xs text-muted-foreground">para comparação</span>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Fornecedores</CardTitle>
                    <CardDescription>Por volume de compras no período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {compras.topFornecedores.length === 0
                      ? <EmptyState icon={ShoppingCart} title="Nenhuma NF lançada no período" desc="Lance notas fiscais no módulo Compras." />
                      : <div className="space-y-2">
                          {compras.topFornecedores.map((f, i) => (
                            <div key={f.nome} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{f.nome}</p>
                                  <p className="text-xs text-muted-foreground">{f.nfs} {f.nfs===1?'nota':'notas'}</p>
                                </div>
                              </div>
                              <span className="font-bold text-sm flex-shrink-0">{fmt(f.total)}</span>
                            </div>
                          ))}
                        </div>
                    }
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Materiais Mais Custosos</CardTitle>
                    <CardDescription>Por custo médio ponderado atual</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {compras.itensMaisCostosos.length === 0
                      ? <EmptyState icon={AlertTriangle} title="Nenhum material com custo" desc="Lance entradas de estoque para calcular o custo médio." />
                      : <div className="space-y-2">
                          {compras.itensMaisCostosos.slice(0,7).map((item, i) => (
                            <div key={item.material} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-muted-foreground w-4">{i+1}</span>
                                <span className="text-sm truncate">{item.material}</span>
                              </div>
                              <span className="text-sm font-semibold flex-shrink-0">{fmt(item.custo_medio)}</span>
                            </div>
                          ))}
                        </div>
                    }
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;

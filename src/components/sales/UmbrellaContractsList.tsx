import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Handshake, CalendarClock, Activity, Receipt, TrendingUp, TrendingDown, Wallet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';

interface ExecutionRef {
  composition_id: string;
  name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  number_of_people: number | null;
  price_per_person: number | null;
  value: number | null;
  event_id: string | null;
  event_status: string | null;
}

interface UmbrellaProgress {
  quota_quantity: number | null;
  quota_unit_price: number | null;
  quota_value_total: number;
  consumed_quantity: number;
  consumed_value: number;
  remaining_quantity: number;
  remaining_value: number;
  executions: ExecutionRef[];
  health?: {
    contract_unit_price: number | null;
    unit_cost_today: number | null;
    signing_unit_cost: number | null;
    signing_revision: number | null;
  };
}

interface BillingRef {
  proposal_id: string;
  status: string;
  invoice_number: string | null;
  total_value: number | null;
  created_at: string;
  accounts_receivable?: { status: string; remaining_amount: number; due_date: string } | null;
}

interface ContractRow {
  id: string;
  proposal_number: string;
  event_name: string | null;
  client_po_number: string | null;
  clients?: { name: string } | null;
  client_contacts?: { name: string } | null;
  pending_execution_requests: number;
  pending_change_requests: number;
  progress: UmbrellaProgress | null;
  billing: BillingRef[];
}

interface Props {
  onViewContract: (proposalId: string) => void;
  onNewContract: () => void;
}

const BILLING_STATUS_LABEL: Record<string, string> = {
  preparada: 'Pré-fatura preparada',
  aguardando_aprovacao: 'Aguardando aprovação do cliente',
  aprovada_faturamento: 'Aprovada — emitir NF',
  faturada: 'NF emitida',
  lancada: 'NF lançada',
  reprovada: 'NF reprovada — retrabalhar',
  cancelada: 'Cancelado',
};

const EMPTY_CONTRACTS: ContractRow[] = [];

async function fetchContracts(): Promise<ContractRow[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      id, proposal_number, event_name, client_po_number,
      clients (name),
      client_contacts (name),
      umbrella_execution_requests (id, status),
      proposal_change_requests (id, status)
    `)
    .eq('is_umbrella', true)
    .eq('status', 'Aprovada')
    .is('umbrella_closed_at', null) // concluídos/encerrados saem do portfólio (ficam em Propostas → Encerradas)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = ((data as any) || []) as any[];
  const ids = rows.map(r => r.id);

  // Progresso/saúde por contrato (RPC) + faturamentos, tudo em paralelo
  const [progressList, batchesRes] = await Promise.all([
    Promise.all(rows.map(r =>
      (supabase.rpc as any)('get_umbrella_progress', { p_proposal_id: r.id })
        .then(({ data: d, error: e }: any) => (e ? null : (d as UmbrellaProgress)))
    )),
    ids.length
      ? supabase
          .from('proposal_billing_batches' as any)
          .select('proposal_id, status, invoice_number, total_value, created_at, accounts_receivable (status, remaining_amount, due_date)')
          .in('proposal_id', ids)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (batchesRes.error) throw batchesRes.error;
  const batches = ((batchesRes.data as any) || []) as BillingRef[];

  return rows.map((r, i) => ({
    id: r.id,
    proposal_number: r.proposal_number,
    event_name: r.event_name,
    client_po_number: r.client_po_number,
    clients: r.clients,
    client_contacts: r.client_contacts,
    pending_execution_requests: (r.umbrella_execution_requests || []).filter((x: any) => x.status === 'aberta').length,
    pending_change_requests: (r.proposal_change_requests || []).filter((x: any) => x.status === 'aberta').length,
    progress: progressList[i],
    billing: batches.filter(b => b.proposal_id === r.id),
  }));
}

export default function UmbrellaContractsList({ onViewContract, onNewContract }: Props) {
  const { data: contracts = EMPTY_CONTRACTS, isPending: loading, isError } = useQuery({
    queryKey: ['umbrella-contracts'],
    queryFn: fetchContracts,
  });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar contratos');
  }, [isError]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Derivados por contrato
  const enriched = contracts.map(c => {
    const active = (c.progress?.executions || []).filter(e => e.event_status !== 'Cancelado');
    const upcoming = active
      .filter(e => e.scheduled_date && e.scheduled_date >= todayStr)
      .sort((a, b) => (a.scheduled_date! + (a.scheduled_time || '')).localeCompare(b.scheduled_date! + (b.scheduled_time || '')));
    const next = upcoming[0] || null;

    const price = c.progress?.health?.contract_unit_price ?? null;
    const costToday = c.progress?.health?.unit_cost_today ?? null;
    const costSigning = c.progress?.health?.signing_unit_cost ?? null;
    const marginToday = price && price > 0 && costToday != null ? (price - costToday) / price : null;
    const marginSigning = price && price > 0 && costSigning != null ? (price - costSigning) / price : null;
    const deltaPp = marginToday != null && marginSigning != null ? (marginToday - marginSigning) * 100 : null;

    // Só 'cancelada' sai da conta (cancelamento é permitido apenas pré-NF, sem
    // AR). 'reprovada' FICA: a AR criada na emissão continua viva e o lote é
    // pendência de retrabalho (fluxo T09 do Zeev) — sumir com ele esconderia
    // dinheiro em aberto e a ação pendente ao mesmo tempo.
    const liveBatches = c.billing.filter(b => b.status !== 'cancelada');
    const latestBatch = [...liveBatches].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
    const openAr = liveBatches
      .filter(b => b.accounts_receivable && ['Pendente', 'Parcial', 'Vencido'].includes(b.accounts_receivable.status))
      .reduce((s, b) => s + (b.accounts_receivable?.remaining_amount || 0), 0);
    // O cron só promove Pendente→Vencido; uma AR 'Parcial' vencida fica
    // 'Parcial' pra sempre — por isso o atraso também é checado pela data.
    const hasOverdue = liveBatches.some(b => {
      const ar = b.accounts_receivable;
      if (!ar) return false;
      if (ar.status === 'Vencido') return true;
      return ['Pendente', 'Parcial'].includes(ar.status) && (ar.remaining_amount || 0) > 0 && ar.due_date < todayStr;
    });

    return { ...c, active, next, marginToday, marginSigning, deltaPp, latestBatch, openAr, hasOverdue };
  });

  // KPIs do portfólio. Saldo com piso em zero por contrato: contrato sem cota
  // (ou estourado) tem remaining negativo no RPC e encolheria o total dos outros.
  const kpiContratado = enriched.reduce((s, c) => s + (c.progress?.quota_value_total || 0), 0);
  const kpiSaldoValor = enriched.reduce((s, c) => s + Math.max(0, c.progress?.remaining_value || 0), 0);
  const kpiSaldoQtd = enriched.reduce((s, c) => s + Math.max(0, c.progress?.remaining_quantity || 0), 0);
  const kpiEmAberto = enriched.reduce((s, c) => s + c.openAr, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Carregando contratos...</div>
        </CardContent>
      </Card>
    );
  }

  // Erro NÃO pode cair no empty state ("nenhum contrato") — afirmaria que os
  // contratos sumiram quando foi a consulta que falhou.
  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            Não foi possível carregar os contratos. Recarregue a página para tentar de novo.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5" /> Contratos recorrentes
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Contratos guarda-chuva ativos: saldo, fornecimentos, saúde e faturamento
              </p>
            </div>
            <Button onClick={onNewContract}>
              <Plus size={16} className="mr-2" />
              Novo contrato recorrente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* KPIs do portfólio */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <Handshake className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{enriched.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Contratos ativos</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{formatCurrency(kpiContratado)}</p>
                <p className="text-xs text-muted-foreground mt-1">Valor contratado</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{formatCurrency(kpiSaldoValor)}</p>
                <p className="text-xs text-muted-foreground mt-1">Saldo a fornecer · {kpiSaldoQtd} un</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <Receipt className="h-5 w-5 text-orange-600 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{formatCurrency(kpiEmAberto)}</p>
                <p className="text-xs text-muted-foreground mt-1">Faturamento em aberto</p>
              </div>
            </div>
          </div>

          {/* Cards de contrato */}
          {enriched.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>Nenhum contrato recorrente ativo ainda.</p>
              <p className="text-sm mt-1">
                Crie com "Novo contrato recorrente" — a proposta segue o fluxo normal de negociação e,
                quando aprovada, o contrato aparece aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {enriched.map(c => {
                const pct = c.progress?.quota_quantity
                  ? Math.min(100, (c.progress.consumed_quantity / c.progress.quota_quantity) * 100)
                  : 0;
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => onViewContract(c.id)}
                  >
                    {/* Cliente em primeiro plano; contrato na linha de baixo */}
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div>
                        <p className="text-lg font-bold leading-tight">{c.clients?.name || '—'}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {c.event_name || 'Contrato recorrente'} · Prop. {c.proposal_number}
                          {c.client_po_number && <> · Pedido {c.client_po_number}</>}
                          {c.client_contacts?.name && <> · Contato: {c.client_contacts.name}</>}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Ativo</Badge>
                        {c.pending_execution_requests > 0 && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                            {c.pending_execution_requests} fornecimento{c.pending_execution_requests > 1 ? 's' : ''} a confirmar
                          </Badge>
                        )}
                        {c.pending_change_requests > 0 && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                            Alteração em análise
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Consumo da cota */}
                    <div className="mt-3">
                      <Progress value={pct} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1.5 flex-wrap gap-2">
                        <span>
                          Consumido: <span className="font-medium text-foreground">
                            {c.progress?.consumed_quantity ?? 0} un · {formatCurrency(c.progress?.consumed_value || 0)}
                          </span> ({pct.toFixed(1).replace('.', ',')}%)
                        </span>
                        <span>
                          Cota: <span className="font-medium text-foreground">
                            {c.progress?.quota_quantity ?? '—'} un × {formatCurrency(c.progress?.quota_unit_price || 0)} = {formatCurrency(c.progress?.quota_value_total || 0)}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Próximo fornecimento · Saúde · Faturamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t mt-3 pt-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> Próximo fornecimento
                        </p>
                        {c.next ? (
                          <>
                            <p className="font-medium mt-0.5">
                              {formatLocalDate(c.next.scheduled_date!)}
                              {c.next.scheduled_time && <> · {c.next.scheduled_time.slice(0, 5)}</>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.next.name || 'Fornecimento'}{c.next.number_of_people ? ` · ${c.next.number_of_people} pessoas` : ''}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-0.5">Nenhum agendado</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Saúde da margem
                        </p>
                        {c.marginToday != null ? (
                          <>
                            <p className="font-medium mt-0.5 flex items-center gap-1.5">
                              {(c.marginToday * 100).toFixed(1).replace('.', ',')}% hoje
                              {c.deltaPp != null && Math.abs(c.deltaPp) >= 0.05 && (
                                <span className={`text-xs flex items-center gap-0.5 ${c.deltaPp < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {c.deltaPp < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                  {Math.abs(c.deltaPp).toFixed(1).replace('.', ',')} p.p.
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.marginSigning != null
                                ? <>na assinatura: {(c.marginSigning * 100).toFixed(1).replace('.', ',')}%{c.deltaPp != null && c.deltaPp <= -3 && <span className="text-red-600 font-medium"> — renegociar?</span>}</>
                                : 'sem snapshot da assinatura'}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-0.5">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Receipt className="h-3 w-3" /> Faturamento
                        </p>
                        {c.latestBatch ? (
                          <>
                            <p className={`font-medium mt-0.5 ${c.latestBatch.status === 'reprovada' ? 'text-red-600' : ''}`}>
                              {c.latestBatch.status === 'lancada' && c.latestBatch.invoice_number
                                ? `NF ${c.latestBatch.invoice_number} lançada`
                                : c.latestBatch.status === 'faturada' && c.latestBatch.invoice_number
                                  ? `NF ${c.latestBatch.invoice_number} emitida`
                                  : c.latestBatch.status === 'reprovada' && c.latestBatch.invoice_number
                                    ? `NF ${c.latestBatch.invoice_number} reprovada — retrabalho`
                                    : BILLING_STATUS_LABEL[c.latestBatch.status] || c.latestBatch.status}
                            </p>
                            <p className={`text-xs ${c.hasOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {c.openAr > 0
                                ? <>{formatCurrency(c.openAr)} em aberto{c.hasOverdue && ' · vencido'}</>
                                : 'nada em aberto'}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-0.5">Nenhum faturamento ainda</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t mt-3 pt-2.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-normal">
                        {c.active.length} fornecimento{c.active.length !== 1 ? 's' : ''} lançado{c.active.length !== 1 ? 's' : ''}
                      </Badge>
                      <span>Clique para abrir o painel de saldo e execuções</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageCircle, ChevronRight, ChevronDown, Coffee, CalendarDays, Users, Repeat, MapPin, Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalClient } from '@/hooks/usePortalClient';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate, parseLocalDate, todayLocalISO } from '@/lib/date-utils';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import heroHome from '@/assets/portal/buffet-6.jpg';

interface PaymentSummary {
  billed_total: number;
  open_amount: number;
  overdue_amount: number;
  next_due_date: string | null;
  payment_status: 'Vencido' | 'Em aberto' | 'Pago';
}

interface PortalProposalRow {
  id: string; proposal_number: string; event_name: string | null; event_category: string | null;
  event_date: string | null; number_of_people: number | null;
  total_amount: number | null; status: string; created_by_client: boolean;
  is_umbrella: boolean;
  umbrella_quota_quantity: number | null;
  umbrella_quota_unit_price: number | null;
  consumed_quantity: number | null;
  next_execution_date: string | null;
  last_execution_date: string | null;
  payment_summary: PaymentSummary | null;
}

interface PortalPaymentRow {
  id: string; description: string | null; invoice_number: string | null;
  due_date: string | null; original_amount: number | null;
  received_amount: number | null; remaining_amount: number | null;
  status: string; proposal_id: string; proposal_number: string; event_name: string | null;
}

// Selo de pagamento do pedido (só aparece quando há cobrança vinculada).
function paymentBadge(ps: PaymentSummary | null) {
  if (!ps) return null;
  switch (ps.payment_status) {
    case 'Vencido':   return { label: 'Pagamento em atraso', cls: 'bg-destructive/15 text-destructive' };
    case 'Em aberto': return { label: 'Pagamento em aberto', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Pago':      return { label: 'Pago', cls: 'bg-primary/15 text-primary' };
    default: return null;
  }
}

interface PortalEventRow {
  event_id: string; proposal_id: string; event_name: string | null;
  event_date: string; setup_time: string | null; venue: string | null;
  status: string; total_people: number | null;
}

// Rótulo amigável + cor do status para o cliente. "Enviada" muda de sentido
// conforme quem criou: proposta da equipe pro cliente aprovar (aguarda o
// cliente) vs. pedido que o próprio cliente montou (já foi enviado, aguarda
// a equipe Coffeelier — nada pendente do lado do cliente).
function statusBadge(status: string, createdByClient: boolean) {
  switch (status) {
    case 'Rascunho': return { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' };
    case 'Enviada': return createdByClient
      ? { label: 'Em análise pela equipe', cls: 'bg-muted text-muted-foreground' }
      : { label: 'Aguardando você', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Aprovada pelo Cliente': return { label: 'Em confirmação', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Aprovada': return { label: 'Confirmada', cls: 'bg-primary/15 text-primary' };
    case 'Rejeitada': return { label: 'Recusada', cls: 'bg-destructive/15 text-destructive' };
    case 'Cancelada': return { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' };
    default: return { label: status, cls: 'bg-muted text-muted-foreground' };
  }
}

// Timeline do portal: pendente/futuro sempre no topo ("Em aberto"); o que já
// foi fornecido, cancelado ou recusado desce pra "Encerrados" (recolhido).
function isOpenOrder(p: PortalProposalRow, today: string): boolean {
  if (['Cancelada', 'Rejeitada'].includes(p.status)) return false;
  // Qualquer pedido ainda não confirmado continua em aberto — inclusive
  // recorrente com a cota toda alocada (aprovação ainda pendente).
  if (['Rascunho', 'Enviada', 'Aprovada pelo Cliente'].includes(p.status)) return true;
  if (p.is_umbrella) {
    const quotaLeft = p.umbrella_quota_quantity == null
      || (p.consumed_quantity ?? 0) < p.umbrella_quota_quantity;
    return quotaLeft || !!p.next_execution_date;
  }
  return !p.event_date || p.event_date >= today;
}

// Data de referência pra ordenar a timeline (recorrente = próxima execução).
const timelineDate = (p: PortalProposalRow): string | null =>
  p.is_umbrella ? (p.next_execution_date ?? p.last_execution_date ?? p.event_date) : p.event_date;

export default function PortalHome() {
  const navigate = useNavigate();
  const { portalClient, user } = usePortalClient();
  const [showClosed, setShowClosed] = useState(false);
  const firstName = (
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.display_name as string) ||
    user?.email?.split('@')[0] || 'cliente'
  ).split(' ')[0];
  const { contactHref } = usePortalSettings();

  const { data: proposals = [], isPending } = useQuery({
    queryKey: ['portal-proposals'],
    queryFn: async (): Promise<PortalProposalRow[]> => {
      const { data, error } = await supabase.rpc('get_portal_proposals');
      if (error) throw error;
      return (data as PortalProposalRow[]) ?? [];
    },
  });

  const { data: myEvents = [] } = useQuery({
    queryKey: ['portal-my-events'],
    queryFn: async (): Promise<PortalEventRow[]> => {
      const { data, error } = await supabase.rpc('get_portal_my_events');
      if (error) throw error;
      return (data as PortalEventRow[]) ?? [];
    },
  });

  const { data: myPayments = [] } = useQuery({
    queryKey: ['portal-my-payments'],
    queryFn: async (): Promise<PortalPaymentRow[]> => {
      const { data, error } = await supabase.rpc('get_portal_my_payments');
      if (error) throw error;
      return (data as PortalPaymentRow[]) ?? [];
    },
  });

  const today = todayLocalISO();
  const openOrders = proposals
    .filter(p => isOpenOrder(p, today))
    .sort((a, b) => {
      const da = timelineDate(a), db = timelineDate(b);
      if (da === db) return 0;
      if (da == null) return 1;   // sem data vai pro fim do "Em aberto"
      if (db == null) return -1;
      return da < db ? -1 : 1;    // mais próximo primeiro
    });
  const closedOrders = proposals
    .filter(p => !isOpenOrder(p, today))
    .sort((a, b) => {
      const da = timelineDate(a), db = timelineDate(b);
      if (da === db) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da > db ? -1 : 1;    // mais recente primeiro
    });

  const eventDates = myEvents.map(e => parseLocalDate(e.event_date));
  const upcomingEvents = myEvents.filter(e => e.event_date >= today).slice(0, 4);

  // Resumo financeiro dos pedidos deste usuário (cobranças vinculadas).
  const openPayments = myPayments.filter(p => ['Pendente', 'Parcial', 'Vencido'].includes(p.status));
  const overduePayments = myPayments.filter(p => p.status === 'Vencido');
  const openTotal = openPayments.reduce((s, p) => s + (p.remaining_amount ?? 0), 0);
  const overdueTotal = overduePayments.reduce((s, p) => s + (p.remaining_amount ?? 0), 0);
  const nextPayments = [...overduePayments, ...openPayments.filter(p => p.status !== 'Vencido')].slice(0, 4);

  const renderOrderCard = (p: PortalProposalRow) => {
    const badge = statusBadge(p.status, p.created_by_client);
    const payBadge = paymentBadge(p.payment_summary);
    const quota = p.umbrella_quota_quantity ?? 0;
    const consumed = p.consumed_quantity ?? 0;
    const pct = p.is_umbrella && quota > 0 ? Math.min(100, (consumed / quota) * 100) : 0;
    return (
      <button key={p.id} onClick={() => {
        // Pedido do próprio cliente ainda não aprovado: continua editável direto
        // na tela de montagem. Depois de aprovado, ou se veio da equipe, é só visualização.
        const editable = p.created_by_client && ['Rascunho', 'Enviada'].includes(p.status);
        navigate(editable ? `/portal/novo-pedido?draft=${p.id}` : `/portal/proposta/${p.id}`);
      }}
        className="w-full text-left bg-card border border-border/70 rounded-2xl p-5 md:p-6
                   shadow-soft hover:shadow-warm transition-shadow">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg, hsl(34 52% 65%), hsl(34 88% 90%))' }}>
            {p.is_umbrella
              ? <Repeat className="h-6 w-6 text-accent-coffee" />
              : <Coffee className="h-6 w-6 text-accent-coffee" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg truncate flex items-center gap-2">
              <span className="truncate">
                {p.event_name || p.event_category || 'Pedido'} · Proposta {p.proposal_number}
              </span>
              {p.is_umbrella && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-mocca/30 text-accent-coffee whitespace-nowrap">
                  Recorrente
                </span>
              )}
            </div>
            <div className="text-muted-foreground text-sm mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {p.is_umbrella ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {p.next_execution_date
                    ? `Próximo fornecimento: ${formatLocalDate(p.next_execution_date)}`
                    : p.last_execution_date
                      ? `Último fornecimento: ${formatLocalDate(p.last_execution_date)}`
                      : 'Sem fornecimentos agendados'}
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />{p.event_date ? formatLocalDate(p.event_date) : 'A definir'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />{p.number_of_people ?? '—'} pessoas
                  </span>
                </>
              )}
            </div>
          </div>
          {!p.is_umbrella && (
            <div className="text-xl font-semibold hidden sm:block">{formatCurrency(p.total_amount)}</div>
          )}
          <span className="flex flex-col items-end gap-1.5">
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}>
              {badge.label}
            </span>
            {payBadge && (
              <span className={`px-3.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${payBadge.cls}`}>
                {payBadge.label}
              </span>
            )}
          </span>
          <ChevronRight className="h-5 w-5 text-accent-mocca shrink-0" />
        </div>
        {p.is_umbrella && quota > 0 && (
          <div className="mt-4 pl-0 sm:pl-[76px]">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Consumido {consumed} de {quota}</span>
              <span>Restam {Math.max(0, quota - consumed)}</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )}
      </button>
    );
  };

  return (
    <PortalLayout>
      <div className="relative rounded-3xl overflow-hidden shadow-warm">
        <img src={heroHome} alt="" className="w-full h-44 md:h-56 object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, hsl(20 54% 16% / .88), hsl(20 54% 20% / .55) 60%, hsl(20 54% 20% / .25))' }} />
        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 text-accent-creme">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            Bem-vindo de volta, {firstName}
          </h1>
          <p className="opacity-90 mt-1.5 max-w-md">
            Você está no ambiente de pedidos da {portalClient?.clientName || 'sua empresa'}.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-7 mb-10">
        <Button
          className="flex-1 h-auto py-5 rounded-2xl text-base font-semibold text-accent-creme shadow-warm justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}
          onClick={() => navigate('/portal/novo-pedido')}>
          <Plus className="h-5 w-5" /> Montar um novo pedido
        </Button>
        <Button variant="outline" asChild
          className="h-auto py-5 rounded-2xl text-base font-semibold gap-3 bg-card shadow-soft">
          <a href={contactHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-5 w-5" /> Falar com a Coffeelier
          </a>
        </Button>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Meus pedidos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-8 items-start">
        {/* ── Timeline de pedidos ── */}
        <div>
          {isPending ? (
            <div className="py-10 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
              <Coffee className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Você ainda não tem pedidos. Quando recebermos uma proposta, ela aparecerá aqui.
            </div>
          ) : (
            <div className="space-y-3.5">
              {openOrders.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                  Nenhum pedido em aberto no momento.
                </div>
              )}
              {openOrders.map(renderOrderCard)}

              {closedOrders.length > 0 && (
                <div className="pt-4">
                  <button
                    onClick={() => setShowClosed(v => !v)}
                    className="w-full flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${showClosed ? '' : '-rotate-90'}`} />
                    Encerrados ({closedOrders.length})
                  </button>
                  {showClosed && (
                    <div className="space-y-3.5 mt-2 opacity-75">
                      {closedOrders.map(renderOrderCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Coluna lateral: calendário + pagamentos (só deste usuário) ── */}
        <div className="space-y-6">
        <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Meu calendário
          </h3>
          <Calendar
            mode="default"
            modifiers={{ event: eventDates }}
            modifiersClassNames={{
              event: "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary after:content-['']",
            }}
          />
          {upcomingEvents.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/70 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próximos eventos</p>
              {upcomingEvents.map(e => (
                <button key={e.event_id}
                  onClick={() => navigate(`/portal/proposta/${e.proposal_id}`)}
                  className="w-full text-left text-sm flex items-start gap-2.5 hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors">
                  <span className="shrink-0 w-11 text-center rounded-lg bg-accent-mocca/25 text-accent-coffee font-semibold text-xs py-1">
                    {formatLocalDate(e.event_date, 'dd/MM')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{e.event_name || 'Evento'}</span>
                    {e.venue && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{e.venue}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Pagamentos: resumo das cobranças dos pedidos deste usuário ── */}
        {myPayments.length > 0 && (
          <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Wallet className="h-4 w-4 text-primary" /> Pagamentos
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Em aberto</span>
                <span className="font-semibold">{formatCurrency(openTotal)}</span>
              </div>
              {overdueTotal > 0 && (
                <div className="flex justify-between text-destructive">
                  <span className="font-medium">Em atraso ({overduePayments.length})</span>
                  <span className="font-semibold">{formatCurrency(overdueTotal)}</span>
                </div>
              )}
              {openTotal === 0 && (
                <p className="text-muted-foreground text-xs">Nenhuma cobrança em aberto. 🎉</p>
              )}
            </div>
            {nextPayments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/70 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vencimentos</p>
                {nextPayments.map(p => {
                  const overdue = p.status === 'Vencido';
                  return (
                    <button key={p.id}
                      onClick={() => navigate(`/portal/proposta/${p.proposal_id}`)}
                      className="w-full text-left text-sm flex items-start gap-2.5 hover:bg-muted/50 rounded-lg p-1.5 -m-1.5 transition-colors">
                      <span className={`shrink-0 w-11 text-center rounded-lg font-semibold text-xs py-1 ${
                        overdue ? 'bg-destructive/15 text-destructive' : 'bg-accent-mocca/25 text-accent-coffee'}`}>
                        {p.due_date ? formatLocalDate(p.due_date, 'dd/MM') : '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {p.event_name || p.description || `Proposta ${p.proposal_number}`}
                        </span>
                        <span className={`text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {formatCurrency(p.remaining_amount)} · {overdue ? 'em atraso' : p.status === 'Parcial' ? 'parcial' : 'a vencer'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </PortalLayout>
  );
}

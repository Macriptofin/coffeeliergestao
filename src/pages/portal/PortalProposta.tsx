import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, Pencil, SquarePen, Download, MessageCircle, CalendarDays, Clock, Users, MapPin, Repeat, Tag, Coins, Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalClient } from '@/hooks/usePortalClient';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate, parseLocalDate, todayLocalISO } from '@/lib/date-utils';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import { PortalProposalPDF } from '@/components/portal/PortalProposalPDF';
import { isPrazoMinimoMessage, showPrazoMinimoToast } from '@/components/portal/PrazoMinimoToast';
import { toast } from 'sonner';

interface Item { name: string; qty_per_person: number | null; fixed_qty: number | null; unit: string | null; }
interface Section { category_label: string; items: Item[] | null; }
interface Composition {
  name: string; event_category: string | null; scheduled_date: string | null; scheduled_time: string | null;
  location: string | null; number_of_people: number | null; price_per_person: number | null;
  categories: Section[] | null;
}
interface ProposalPayment {
  id: string; description: string | null; invoice_number: string | null;
  due_date: string | null; original_amount: number | null;
  received_amount: number | null; remaining_amount: number | null; status: string;
}
interface ExecutionRequest {
  id: string; name: string; scheduled_date: string; scheduled_time: string | null;
  number_of_people: number; room_name: string | null; status: string; created_at: string;
  kind: 'nova' | 'alteracao'; target_name: string | null;
}
interface PortalExecution {
  composition_id: string; name: string; scheduled_date: string | null; scheduled_time: string | null;
  number_of_people: number | null; room_id: string | null; room_name: string | null;
  location: string | null; event_status: string | null; has_open_request: boolean;
}

interface PortalProposalDetail {
  id: string; proposal_number: string; event_name: string | null; event_category: string | null;
  number_of_people: number | null; event_date: string | null; total_amount: number | null;
  status: string; created_by_client: boolean; payment_terms: string | null; notes: string | null;
  client_name: string | null; department_name: string | null; unit_name: string | null;
  room_name: string | null; event_location_name: string | null;
  is_umbrella: boolean; umbrella_quota_quantity: number | null;
  umbrella_quota_unit_price: number | null; consumed_quantity: number | null;
  consumed_value: number | null;
  has_open_change_request: boolean;
  execution_requests: ExecutionRequest[] | null;
  executions: PortalExecution[] | null;
  payments: ProposalPayment[] | null;
  compositions: Composition[] | null; categories_no_composition: Section[] | null;
  error?: string;
}

// Selo de status da cobrança, na linguagem do cliente.
function paymentStatusBadge(status: string) {
  switch (status) {
    case 'Vencido':  return { label: 'Em atraso', cls: 'bg-destructive/15 text-destructive' };
    case 'Parcial':  return { label: 'Parcial', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Pendente': return { label: 'A vencer', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Recebido': return { label: 'Pago', cls: 'bg-primary/15 text-primary' };
    default: return { label: status, cls: 'bg-muted text-muted-foreground' };
  }
}

const itemQty = (it: Item) =>
  it.qty_per_person != null
    ? `${it.qty_per_person} ${it.unit || 'un'} / pessoa`
    : `${it.fixed_qty ?? 0} ${it.unit || 'un'}`;

export default function PortalProposta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { portalClient } = usePortalClient();
  const { contactHref, whatsappUrl, contactEmail } = usePortalSettings();
  const [changeOpen, setChangeOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [changeMsg, setChangeMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // Cardápio e condições do contrato abrem em diálogo sobreposto (nada
  // empurra a página — decisão de layout do usuário, 20/ago)
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  // Solicitar fornecimento (novo) ou ALTERAR um fornecimento existente
  // (targetId preenchido = alteração: só data/quantidade/sala — cardápio
  // obedece o contrato).
  const [execOpen, setExecOpen] = useState(false);
  const [execTargetId, setExecTargetId] = useState<string | null>(null);
  const [execForm, setExecForm] = useState({ name: '', date: '', time: '', people: '', unitId: '', roomId: '', notes: '' });

  const openExecDialog = (target?: PortalExecution) => {
    if (target) {
      setExecTargetId(target.composition_id);
      setExecForm({
        name: target.name || '',
        date: target.scheduled_date || '',
        time: target.scheduled_time ? String(target.scheduled_time).slice(0, 5) : '',
        people: target.number_of_people != null ? String(target.number_of_people) : '',
        unitId: '', // resolvido abaixo quando as salas carregarem
        roomId: target.room_id || '',
        notes: '',
      });
    } else {
      setExecTargetId(null);
      setExecForm({ name: '', date: '', time: '', people: '', unitId: '', roomId: '', notes: '' });
    }
    setExecOpen(true);
  };

  const { data, isPending } = useQuery({
    queryKey: ['portal-proposal', id],
    enabled: !!id,
    queryFn: async (): Promise<PortalProposalDetail> => {
      const { data, error } = await supabase.rpc('get_portal_proposal', { p_proposal_id: id });
      if (error) throw error;
      return data as PortalProposalDetail;
    },
  });

  // Estrutura do cliente pro fornecimento: Unidade (prédio) → Sala em cascata
  // (RLS já escopa ao próprio cliente).
  const { data: units = [] } = useQuery({
    queryKey: ['portal-client-units', portalClient?.clientId],
    enabled: !!portalClient?.clientId && execOpen,
    queryFn: async () =>
      (await supabase.from('client_units').select('id, name').eq('client_id', portalClient!.clientId).eq('is_active', true).order('name')).data ?? [],
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ['portal-client-rooms', portalClient?.clientId],
    enabled: !!portalClient?.clientId && execOpen,
    queryFn: async () =>
      (await supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', portalClient!.clientId).eq('is_active', true).order('name')).data ?? [],
  });
  const roomsOfUnit = (rooms as any[]).filter(r => r.unit_id === execForm.unitId);

  // Alteração com sala pré-selecionada: resolve a unidade dela quando as salas
  // carregarem (a cascata Unidade → Sala precisa da unidade preenchida).
  useEffect(() => {
    if (execOpen && execForm.roomId && !execForm.unitId && (rooms as any[]).length) {
      const room = (rooms as any[]).find(r => r.id === execForm.roomId);
      if (room?.unit_id) setExecForm(f => ({ ...f, unitId: room.unit_id }));
    }
  }, [execOpen, rooms, execForm.roomId, execForm.unitId]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      const { data: res, error } = await supabase.rpc('approve_proposal_as_client', { p_proposal_id: id });
      if (error) throw error;
      const r = res as { success: boolean; message: string };
      if (r.success) {
        toast.success(r.message);
        queryClient.invalidateQueries({ queryKey: ['portal-proposal', id] });
        queryClient.invalidateQueries({ queryKey: ['portal-proposals'] });
      } else toast.error(r.message);
    } catch {
      toast.error('Não foi possível aprovar agora. Tente novamente.');
    } finally { setBusy(false); }
  };

  const handleRequestChange = async () => {
    setBusy(true);
    try {
      const { data: res, error } = await supabase.rpc('request_proposal_change', {
        p_proposal_id: id, p_message: changeMsg,
      });
      if (error) throw error;
      const r = res as { success: boolean; message: string };
      if (r.success) {
        toast.success(r.message);
        setChangeOpen(false); setChangeMsg('');
        // Avisa a equipe por e-mail (fire-and-forget — o sininho interno já foi
        // aceso por trigger no banco; falha aqui não pode travar o cliente).
        supabase.functions.invoke('notify-internal-change-request', { body: { proposal_id: id } })
          .then(({ error: nErr }) => { if (nErr) console.warn('notify-internal-change-request:', nErr.message); });
      } else if (isPrazoMinimoMessage(r.message)) {
        showPrazoMinimoToast(r.message, { whatsappUrl, contactEmail });
      } else toast.error(r.message);
    } catch {
      toast.error('Não foi possível enviar a solicitação.');
    } finally { setBusy(false); }
  };

  const handleRequestExecution = async () => {
    setBusy(true);
    try {
      // Sem sala escolhida, a unidade vira o local do fornecimento (a sala já
      // implica a unidade quando informada).
      const unitName = (units as any[]).find(u => u.id === execForm.unitId)?.name || null;
      const { data: res, error } = await supabase.rpc('request_umbrella_execution', {
        p_proposal_id: id,
        p_name: execForm.name,
        p_scheduled_date: execForm.date || null,
        p_scheduled_time: execForm.time || null,
        p_number_of_people: execForm.people ? parseInt(execForm.people) : null,
        p_room_id: execForm.roomId || null,
        p_location: !execForm.roomId && unitName ? unitName : null,
        p_notes: execForm.notes || null,
        p_target_composition_id: execTargetId,
      });
      if (error) throw error;
      const r = res as { success: boolean; message: string };
      if (r.success) {
        toast.success(r.message);
        setExecOpen(false);
        setExecTargetId(null);
        setExecForm({ name: '', date: '', time: '', people: '', unitId: '', roomId: '', notes: '' });
        queryClient.invalidateQueries({ queryKey: ['portal-proposal', id] });
        // Avisa a equipe por e-mail (fire-and-forget — sininho já aceso por trigger)
        supabase.functions.invoke('notify-internal-change-request', { body: { proposal_id: id, kind: 'execution' } })
          .then(({ error: nErr }) => { if (nErr) console.warn('notify-internal-change-request:', nErr.message); });
      } else if (isPrazoMinimoMessage(r.message)) {
        showPrazoMinimoToast(r.message, { whatsappUrl, contactEmail });
      } else toast.error(r.message);
    } catch {
      toast.error('Não foi possível solicitar o fornecimento.');
    } finally { setBusy(false); }
  };

  if (isPending) {
    return <PortalLayout><div className="py-16 flex justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></PortalLayout>;
  }
  if (!data || data.error) {
    return <PortalLayout>
      <p className="text-muted-foreground">{data?.error || 'Proposta não encontrada.'}</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/portal')}>Voltar</Button>
    </PortalLayout>;
  }

  const renderSection = (sec: Section, key: string | number) => (
    <div key={key} className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-soft">
      <h3 className="text-lg font-semibold mb-1">{sec.category_label}</h3>
      <div>
        {(sec.items || []).map((it, j) => (
          <div key={j} className="flex justify-between items-center py-2.5 border-t border-dashed border-border first:border-t-0 text-[15px]">
            <span>{it.name}</span>
            <span className="text-muted-foreground whitespace-nowrap">{itemQty(it)}</span>
          </div>
        ))}
      </div>
    </div>
  );
  const localLabel = [data.unit_name, data.room_name].filter(Boolean).join(' · ')
    || data.event_location_name || 'A definir';
  const firstTime = data.compositions?.[0]?.scheduled_time;
  const pricePerPerson = data.total_amount && data.number_of_people
    ? data.total_amount / data.number_of_people : null;

  // ── Visão macro do contrato recorrente ──────────────────────────────────
  const todayStr = todayLocalISO();
  // Fila de fornecimentos: próximos agendados primeiro (por data); realizados,
  // cancelados e passados descem pro fim (mais recentes primeiro).
  const sortedExecutions = [...(data.executions || [])].sort((a, b) => {
    const rank = (e: PortalExecution) =>
      e.event_status === 'Agendado' && e.scheduled_date && e.scheduled_date >= todayStr ? 0 : 1;
    const ra = rank(a); const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = a.scheduled_date || ''; const db = b.scheduled_date || '';
    return ra === 0 ? da.localeCompare(db) : db.localeCompare(da);
  });
  const nextExecution = sortedExecutions.find(e =>
    e.event_status === 'Agendado' && e.scheduled_date && e.scheduled_date >= todayStr) || null;
  const umbrellaActive = data.is_umbrella === true && (data.status === 'Aprovada' || data.status === 'Aprovada pelo Cliente');
  const contractMenuItemCount = (data.compositions?.[0]?.categories || [])
    .reduce((s, sec) => s + (sec.items?.length || 0), 0);
  // Datas dos fornecimentos vivos pro calendário do contrato (cancelados fora)
  const executionDates = sortedExecutions
    .filter(e => e.event_status !== 'Cancelado' && e.scheduled_date)
    .map(e => parseLocalDate(e.scheduled_date!));

  // Resumo financeiro do contrato a partir das cobranças vinculadas
  const pays = data.payments || [];
  const billedTotal = pays.reduce((s, p) => s + (p.original_amount || 0), 0);
  const openTotal = pays
    .filter(p => ['Pendente', 'Parcial', 'Vencido'].includes(p.status))
    .reduce((s, p) => s + (p.remaining_amount || 0), 0);
  const overduePays = pays.filter(p => p.status === 'Vencido' && (p.remaining_amount || 0) > 0);
  const overdueTotal = overduePays.reduce((s, p) => s + (p.remaining_amount || 0), 0);
  const overdueDays = overduePays.reduce((max, p) => {
    if (!p.due_date) return max;
    const days = Math.floor((new Date(todayStr + 'T12:00:00').getTime() - new Date(p.due_date + 'T12:00:00').getTime()) / 86_400_000);
    return Math.max(max, days);
  }, 0);

  // Pedido que o próprio cliente montou já leva a aprovação do gestor dele por
  // fora do sistema (PDF impresso, botão "Imprimir proposta") antes de enviar —
  // não sobra um "Aprovar pedido" pendente aqui; "Enviada" já é só aguardar a
  // equipe Coffeelier analisar. O botão de aprovação continua existindo só pro
  // caso clássico: proposta que a EQUIPE monta e manda pro cliente aprovar.
  const isClientSubmittedPending = data.created_by_client && data.status === 'Enviada';
  // Solicitação de alteração aberta bloqueia a aprovação: evita aprovar uma
  // versão que a equipe ainda vai mexer (pedido explícito do processo CMPC).
  const canApprove = !isClientSubmittedPending && data.status === 'Enviada'
    && portalClient?.portalRole === 'aprovador' && !data.has_open_change_request;
  const isApproved = data.status === 'Aprovada pelo Cliente' || data.status === 'Aprovada';
  // Pedido montado pelo próprio cliente continua editável direto enquanto não
  // for aprovado — só depois disso (produção já disparada) vira solicitação.
  const isEditable = data.created_by_client && ['Rascunho', 'Enviada'].includes(data.status);

  return (
    <PortalLayout>
      <button onClick={() => navigate('/portal')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ChevronLeft className="h-4 w-4" /> Voltar aos meus pedidos
      </button>

      {/* Contrato ativo: cabeçalho + capa em largura inteira — a grade de duas
          colunas começa junto (Resumo financeiro alinhado com Composição/Condições) */}
      {umbrellaActive && (
        <>
          <p className="text-muted-foreground text-sm mb-1.5">
            {[data.client_name, data.department_name].filter(Boolean).join(' · ')}
          </p>
          {/* Ações do CONTRATO (alteração/PDF) moram no cabeçalho — junto da
              identidade do documento, não no resumo financeiro */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              {data.event_name || data.event_category || 'Pedido'} · Proposta {data.proposal_number}
            </h1>
            <div className="flex gap-2 shrink-0 pt-1">
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => setChangeOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Solicitar alteração
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => setPdfOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Baixar PDF
              </Button>
            </div>
          </div>
          <div className="mt-5 mb-7 rounded-2xl p-6 text-accent-creme shadow-warm grid grid-cols-2 sm:grid-cols-4 gap-5"
               style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
            <CoverItem icon={<Tag className="h-4 w-4" />} label="Tipo"
              value={data.event_category || 'Recorrente'} />
            <CoverItem icon={<Repeat className="h-4 w-4" />} label="Cota contratada"
              value={data.umbrella_quota_quantity != null ? `${data.umbrella_quota_quantity} un` : '—'} />
            <CoverItem icon={<Coins className="h-4 w-4" />} label="Preço unitário"
              value={data.umbrella_quota_unit_price != null ? formatCurrency(data.umbrella_quota_unit_price) : '—'} />
            <CoverItem icon={<CalendarDays className="h-4 w-4" />} label="Próx. fornecimento"
              value={nextExecution?.scheduled_date ? formatLocalDate(nextExecution.scheduled_date) : 'A agendar'} />
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-7">
        {/* Coluna principal */}
        <div>
          {!umbrellaActive && (
            <>
              <p className="text-muted-foreground text-sm mb-1.5">
                {[data.client_name, data.department_name].filter(Boolean).join(' · ')}
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
                {data.event_name || data.event_category || 'Pedido'} · Proposta {data.proposal_number}
              </h1>

              {/* Capa: recorrente em negociação = visão macro; evento único = clássica */}
              <div className="mt-5 rounded-2xl p-6 text-accent-creme shadow-warm grid grid-cols-2 sm:grid-cols-4 gap-5"
                   style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
                {data.is_umbrella ? (
                  <>
                    <CoverItem icon={<Tag className="h-4 w-4" />} label="Tipo"
                      value={data.event_category || 'Recorrente'} />
                    <CoverItem icon={<Repeat className="h-4 w-4" />} label="Cota contratada"
                      value={data.umbrella_quota_quantity != null ? `${data.umbrella_quota_quantity} un` : '—'} />
                    <CoverItem icon={<Coins className="h-4 w-4" />} label="Preço unitário"
                      value={data.umbrella_quota_unit_price != null ? formatCurrency(data.umbrella_quota_unit_price) : '—'} />
                    <CoverItem icon={<CalendarDays className="h-4 w-4" />} label="Próx. fornecimento"
                      value={nextExecution?.scheduled_date ? formatLocalDate(nextExecution.scheduled_date) : 'A agendar'} />
                  </>
                ) : (
                  <>
                    <CoverItem icon={<CalendarDays className="h-4 w-4" />} label="Data"
                      value={data.event_date ? formatLocalDate(data.event_date) : 'A definir'} />
                    <CoverItem icon={<Clock className="h-4 w-4" />} label="Horário" value={firstTime || '—'} />
                    <CoverItem icon={<Users className="h-4 w-4" />} label="Pessoas" value={String(data.number_of_people ?? '—')} />
                    <CoverItem icon={<MapPin className="h-4 w-4" />} label="Local" value={localLabel} />
                  </>
                )}
              </div>
            </>
          )}

          {/* Solicitação de alteração aberta: a bola está com a equipe */}
          {data.has_open_change_request && (
            <div className="mt-5 bg-accent-mocca/20 border border-accent-mocca/40 rounded-2xl px-5 py-4 text-sm">
              Sua solicitação de alteração está <strong>em análise pela equipe Coffeelier</strong> — retornaremos em breve.
            </div>
          )}

          {/* Composição e Condições lado a lado — abrem em diálogo sobreposto,
              nada empurra a página */}
          {data.is_umbrella && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data.compositions || []).length > 0 && (
                <button onClick={() => setMenuDialogOpen(true)}
                  className="bg-card border border-border/70 rounded-2xl p-4 shadow-soft text-left hover:shadow-warm transition-shadow">
                  <p className="font-semibold flex items-center justify-between gap-2">
                    Composição do contrato
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {contractMenuItemCount} {contractMenuItemCount === 1 ? 'item' : 'itens'} no cardápio padrão
                  </p>
                </button>
              )}
              <button onClick={() => setTermsDialogOpen(true)}
                className="bg-card border border-border/70 rounded-2xl p-4 shadow-soft text-left hover:shadow-warm transition-shadow">
                <p className="font-semibold flex items-center justify-between gap-2">
                  Condições do contrato
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {data.payment_terms || 'A combinar'}
                </p>
              </button>
            </div>
          )}

          {/* Pedido recorrente: saldo da cota contratada */}
          {data.is_umbrella && (data.umbrella_quota_quantity ?? 0) > 0 && (() => {
            const quota = data.umbrella_quota_quantity!;
            const consumed = data.consumed_quantity ?? 0;
            const pct = Math.min(100, (consumed / quota) * 100);
            return (
              <div className="mt-5 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Saldo do contrato</h3>
                  <span className="text-sm text-muted-foreground">
                    Consumido {consumed} de {quota}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Contratado</p>
                    <p className="text-lg font-semibold">{quota}</p>
                    {data.umbrella_quota_unit_price != null && (
                      <p className="text-xs text-muted-foreground">{formatCurrency(quota * data.umbrella_quota_unit_price)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Consumido</p>
                    <p className="text-lg font-semibold">{consumed}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(data.consumed_value ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Restante</p>
                    <p className="text-lg font-semibold text-primary">{Math.max(0, quota - consumed)}</p>
                    {data.umbrella_quota_unit_price != null && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(Math.max(0, quota * data.umbrella_quota_unit_price - (data.consumed_value ?? 0)))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fornecimentos do contrato (eventos confirmados) — cada um editável
              individualmente: só data/quantidade/sala, cardápio obedece o contrato */}
          {data.is_umbrella && (sortedExecutions.length > 0 || umbrellaActive) && (
            <div className="mt-5 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
              {/* A ação mora ao lado do objeto que ela afeta: solicitar
                  fornecimento vive no cabeçalho da própria fila */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Fornecimentos</h3>
                {data.status === 'Aprovada' && (
                  <Button size="sm" className="rounded-lg gap-1.5 font-semibold" onClick={() => openExecDialog()}>
                    <Plus className="h-4 w-4" /> Solicitar fornecimento
                  </Button>
                )}
              </div>
              {sortedExecutions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum fornecimento agendado ainda — solicite o primeiro.
                </p>
              )}
              <div className="space-y-2">
                {sortedExecutions.map(ex => {
                  const statusChip = ex.event_status === 'Cancelado'
                    ? { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' }
                    : ex.event_status === 'Concluído'
                      ? { label: 'Realizado', cls: 'bg-primary/15 text-primary' }
                      : ex.has_open_request
                        ? { label: 'Alteração solicitada', cls: 'bg-accent-mocca/35 text-accent-coffee' }
                        : { label: 'Confirmado', cls: 'bg-primary/15 text-primary' };
                  const canEdit = ex.event_status === 'Agendado' && !ex.has_open_request;
                  const isPast = ex.event_status === 'Cancelado' || ex.event_status === 'Concluído'
                    || (ex.scheduled_date != null && ex.scheduled_date < todayStr);
                  return (
                    <div key={ex.composition_id} className="flex items-center justify-between gap-3 text-sm border-t border-dashed border-border/60 first:border-t-0 pt-2 first:pt-0">
                      <div className={`min-w-0 ${isPast ? 'opacity-60' : ''}`}>
                        {nextExecution?.composition_id === ex.composition_id && (
                          <span className="mr-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary">Próximo</span>
                        )}
                        <span className="font-medium">{ex.name}</span>
                        <span className="text-muted-foreground">
                          {ex.scheduled_date ? ` · ${formatLocalDate(ex.scheduled_date)}` : ''}
                          {ex.scheduled_time ? ` às ${String(ex.scheduled_time).slice(0, 5)}` : ''}
                          {ex.number_of_people ? ` · ${ex.number_of_people} pessoas` : ''}
                          {ex.room_name ? ` · ${ex.room_name}` : ex.location ? ` · ${ex.location}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusChip.cls}`}>
                          {statusChip.label}
                        </span>
                        {canEdit && (
                          <Button size="sm" variant="outline" className="h-7 rounded-lg gap-1 text-xs"
                            onClick={() => openExecDialog(ex)}>
                            <Pencil className="h-3 w-3" /> Alterar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Solicitações aguardando a equipe confirmar (novas e alterações) */}
          {(data.execution_requests || []).length > 0 && (
            <div className="mt-5 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
              <h3 className="font-semibold mb-3">Solicitações em análise</h3>
              <div className="space-y-2">
                {(data.execution_requests || []).map(req => (
                  <div key={req.id} className="flex items-center justify-between gap-3 text-sm border-t border-dashed border-border/60 first:border-t-0 pt-2 first:pt-0">
                    <div className="min-w-0">
                      {req.kind === 'alteracao' && (
                        <span className="text-muted-foreground">Alteração de {req.target_name || 'fornecimento'} → </span>
                      )}
                      <span className="font-medium">{req.name}</span>
                      <span className="text-muted-foreground">
                        {' · '}{formatLocalDate(req.scheduled_date)}
                        {req.scheduled_time ? ` às ${String(req.scheduled_time).slice(0, 5)}` : ''}
                        {' · '}{req.number_of_people} pessoas
                        {req.room_name ? ` · ${req.room_name}` : ''}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-accent-mocca/35 text-accent-coffee">
                      Aguardando confirmação
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagamentos deste pedido (cobranças vinculadas pela equipe) */}
          {(data.payments || []).length > 0 && (
            <div className="mt-5 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
              <h3 className="font-semibold mb-2">Pagamentos</h3>
              <div>
                {(data.payments || []).map(pay => {
                  const badge = paymentStatusBadge(pay.status);
                  return (
                    <div key={pay.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-dashed border-border first:border-t-0 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">
                          {pay.description || (pay.invoice_number ? `NF ${pay.invoice_number}` : 'Cobrança')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Vencimento: {pay.due_date ? formatLocalDate(pay.due_date) : '—'}
                          {(pay.received_amount ?? 0) > 0 && pay.status !== 'Recebido'
                            ? ` · pago ${formatCurrency(pay.received_amount)}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-2.5 whitespace-nowrap">
                        <span className="font-semibold">{formatCurrency(pay.original_amount)}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Momentos — cada composição com seu cabeçalho e seções.
              Recorrente: nada aqui — o cardápio vive na "Composição do
              contrato" (recolhível) lá em cima. */}
          <div className="mt-6 space-y-7">
            {(data.is_umbrella ? [] : (data.compositions || [])).map((comp, ci) => {
              const meta = [
                comp.event_category,
                comp.scheduled_date ? formatLocalDate(comp.scheduled_date) : null,
                (comp.scheduled_time || '').slice(0, 5) || null,
                comp.location,
                comp.number_of_people ? `${comp.number_of_people} pessoas` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div key={ci} className="space-y-3">
                  <div className="border-l-4 border-primary pl-3">
                    <h2 className="text-xl font-semibold leading-tight">
                      {comp.name || `Momento ${ci + 1}`}
                    </h2>
                    {meta && <p className="text-sm text-muted-foreground mt-0.5">{meta}</p>}
                  </div>
                  {(comp.categories || []).map((sec, i) => renderSection(sec, `${ci}-${i}`))}
                </div>
              );
            })}

            {/* Legado: categorias sem composição (pedidos antigos) */}
            {(data.categories_no_composition || []).length > 0 && (
              <div className="space-y-3">
                {(data.categories_no_composition || []).map((sec, i) => renderSection(sec, `legacy-${i}`))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna de ações */}
        <div className="lg:sticky lg:top-6 self-start">
          {umbrellaActive ? (
            /* Contrato ativo: lateral = SÓ resumo financeiro (ações do contrato
               moraram pro cabeçalho; fornecimento mora na fila; condições no
               cartão próprio da coluna principal) */
            <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" /> Resumo financeiro
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${data.status === 'Aprovada' ? 'bg-primary/15 text-primary' : 'bg-accent-mocca/35 text-accent-coffee'}`}>
                  {data.status === 'Aprovada' ? 'Confirmado' : 'Em confirmação'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-4">Total do contrato</div>
              <div className="text-3xl font-bold mt-0.5">{formatCurrency(data.total_amount)}</div>
              {data.umbrella_quota_unit_price != null && (
                <div className="text-muted-foreground text-sm mt-1">
                  {formatCurrency(data.umbrella_quota_unit_price)} por unidade · cota de {data.umbrella_quota_quantity ?? '—'}
                </div>
              )}
              {pays.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-border text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Faturado</span>
                    <span className="font-medium">{formatCurrency(billedTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Em aberto</span>
                    <span className="font-medium">{formatCurrency(openTotal)}</span>
                  </div>
                  {overdueTotal > 0 && (
                    <div className="flex justify-between text-destructive font-semibold">
                      <span>Em atraso{overdueDays > 0 ? ` (${overdueDays} dia${overdueDays > 1 ? 's' : ''})` : ''}</span>
                      <span>{formatCurrency(overdueTotal)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  Nenhuma cobrança lançada ainda.
                </p>
              )}
            </div>
          ) : (
          <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-soft">
            <div className="text-sm text-muted-foreground">{data.is_umbrella ? 'Total do contrato' : 'Total do pedido'}</div>
            <div className="text-4xl font-bold mt-0.5">{formatCurrency(data.total_amount)}</div>
            {/* Recorrente: o "por pessoa" certo é o preço unitário do contrato
                (total ÷ pessoas da composição-molde não significa nada). */}
            {data.is_umbrella ? (
              data.umbrella_quota_unit_price != null && (
                <div className="text-muted-foreground text-sm mt-1">
                  {formatCurrency(data.umbrella_quota_unit_price)} por unidade · cota de {data.umbrella_quota_quantity ?? '—'}
                </div>
              )
            ) : pricePerPerson != null && (
              <div className="text-muted-foreground text-sm mt-1">
                {formatCurrency(pricePerPerson)} por pessoa · {data.number_of_people} pessoas
              </div>
            )}

            {/* Resumo financeiro do contrato (cobranças vinculadas) */}
            {pays.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Faturado</span>
                  <span className="font-medium">{formatCurrency(billedTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Em aberto</span>
                  <span className="font-medium">{formatCurrency(openTotal)}</span>
                </div>
                {overdueTotal > 0 && (
                  <div className="flex justify-between text-destructive font-semibold">
                    <span>Em atraso{overdueDays > 0 ? ` (${overdueDays} dia${overdueDays > 1 ? 's' : ''})` : ''}</span>
                    <span>{formatCurrency(overdueTotal)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-3">
              {isApproved ? (
                <div className="rounded-xl bg-primary/10 text-primary text-sm font-semibold px-4 py-3 text-center">
                  ✓ {data.status === 'Aprovada' ? 'Pedido confirmado' : 'Aprovado — em confirmação pela equipe'}
                </div>
              ) : isClientSubmittedPending ? (
                <div className="rounded-xl bg-muted text-muted-foreground text-sm font-semibold px-4 py-3 text-center">
                  Enviado — em análise pela equipe Coffeelier
                </div>
              ) : (
                <Button onClick={handleApprove} disabled={!canApprove || busy}
                  className="w-full h-12 rounded-xl text-base font-semibold text-accent-creme shadow-warm gap-2"
                  style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
                  <Check className="h-5 w-5" /> Aprovar pedido
                </Button>
              )}
              {/* Botão desativado nunca fica mudo: explica o porquê */}
              {!isApproved && !isClientSubmittedPending && !canApprove && data.status === 'Enviada' && (
                <p className="text-xs text-muted-foreground text-center">
                  {data.has_open_change_request
                    ? 'A aprovação fica bloqueada enquanto sua solicitação de alteração está em análise.'
                    : 'Apenas um aprovador da sua empresa pode aprovar este pedido.'}
                </p>
              )}
              {!isApproved && !isClientSubmittedPending && data.status === 'Rascunho' && !data.created_by_client && (
                <p className="text-xs text-muted-foreground text-center">
                  Este pedido está em revisão pela equipe Coffeelier — a aprovação
                  reabre quando a nova versão for enviada.
                </p>
              )}

              {/* Contrato recorrente confirmado: cliente solicita fornecimentos
                  (a equipe aprova e só então nascem evento + ordens) */}
              {data.is_umbrella && data.status === 'Aprovada' && (
                <Button className="w-full h-11 rounded-xl gap-2 font-semibold" variant="secondary"
                  onClick={() => openExecDialog()}>
                  <CalendarDays className="h-4 w-4" /> Solicitar fornecimento
                </Button>
              )}
              {isEditable ? (
                <Button variant="outline" className="w-full h-11 rounded-xl gap-2"
                  onClick={() => navigate(`/portal/novo-pedido?draft=${id}`)}>
                  <SquarePen className="h-4 w-4" /> Editar pedido
                </Button>
              ) : (
                <Button variant="outline" className="w-full h-11 rounded-xl gap-2" onClick={() => setChangeOpen(true)}>
                  <Pencil className="h-4 w-4" /> Solicitar alteração
                </Button>
              )}
              <Button variant="outline" className="w-full h-11 rounded-xl gap-2" onClick={() => setPdfOpen(true)}>
                <Download className="h-4 w-4" /> Baixar PDF
              </Button>
            </div>

            <div className="mt-5 pt-4 border-t border-border text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Condição de pagamento</span><br />
              {data.payment_terms || 'A combinar'}<br /><br />
              Inclui montagem, transporte e recolhimento. Validade da proposta: 15 dias.
            </div>
          </div>
          )}

          <a href={contactHref} target="_blank" rel="noopener noreferrer"
             className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline">
            <MessageCircle className="h-4 w-4" /> Falar com a Coffeelier
          </a>

          {/* Calendário do contrato: bloco próprio abaixo do resumo financeiro,
              no MÊS ATUAL (âncora do hoje), com as datas dos fornecimentos vivos */}
          {umbrellaActive && (
            <div className="mt-4 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Calendário do contrato
              </h3>
              <Calendar
                mode="default"
                modifiers={{ event: executionDates }}
                modifiersClassNames={{
                  event: "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary after:content-['']",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Diálogo: cardápio do contrato (sobreposto — não empurra a página) */}
      <Dialog open={menuDialogOpen} onOpenChange={setMenuDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Composição do contrato</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Cardápio padrão servido em todos os fornecimentos deste contrato.
          </p>
          <div className="space-y-4">
            {(data.compositions?.[0]?.categories || []).map((sec, i) => renderSection(sec, `contract-dialog-${i}`))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: condições do contrato */}
      <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Condições do contrato</DialogTitle></DialogHeader>
          <div className="text-sm space-y-4">
            <div>
              <p className="font-semibold mb-0.5">Condição de pagamento</p>
              <p className="text-muted-foreground">{data.payment_terms || 'A combinar'}</p>
            </div>
            <div>
              <p className="font-semibold mb-0.5">Escopo</p>
              <p className="text-muted-foreground">Inclui montagem, transporte e recolhimento.</p>
            </div>
            <div>
              <p className="font-semibold mb-0.5">Validade da proposta</p>
              <p className="text-muted-foreground">15 dias a partir da emissão.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: solicitar fornecimento novo OU alterar um existente */}
      <Dialog open={execOpen} onOpenChange={(open) => { setExecOpen(open); if (!open) setExecTargetId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{execTargetId ? 'Alterar fornecimento' : 'Solicitar fornecimento'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            {execTargetId
              ? 'Ajuste data, quantidade ou sala — o cardápio segue a composição do contrato. Nossa equipe confirma a alteração.'
              : 'Informe os dados do evento. Nossa equipe confirma o fornecimento e ele entra na sua agenda, abatendo do saldo contratado.'}
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do evento *</Label>
              <Input value={execForm.name} onChange={e => setExecForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Reunião mensal de resultados" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={execForm.date} onChange={e => setExecForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" value={execForm.time} onChange={e => setExecForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nº de pessoas *</Label>
              <Input type="number" min="1" value={execForm.people}
                onChange={e => setExecForm(f => ({ ...f, people: e.target.value }))} placeholder="Ex: 50" />
            </div>
            {/* Cascata: primeiro a Unidade (prédio), depois só as salas dela */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={execForm.unitId}
                  onValueChange={v => setExecForm(f => ({ ...f, unitId: v, roomId: '' }))}>
                  <SelectTrigger><SelectValue placeholder={units.length ? 'Selecione' : 'Sem unidades'} /></SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sala</Label>
                <Select value={execForm.roomId} onValueChange={v => setExecForm(f => ({ ...f, roomId: v }))}
                  disabled={!execForm.unitId}>
                  <SelectTrigger>
                    <SelectValue placeholder={!execForm.unitId ? 'Selecione a unidade' : roomsOfUnit.length ? 'Selecione' : 'Sem salas nesta unidade'} />
                  </SelectTrigger>
                  <SelectContent>
                    {roomsOfUnit.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={execForm.notes} onChange={e => setExecForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Algo que a equipe precise saber?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequestExecution}
              disabled={busy || !execForm.name.trim() || !execForm.date || !execForm.people}>
              {execTargetId ? 'Solicitar alteração' : 'Solicitar fornecimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: solicitar alteração */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar alteração</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Conte o que gostaria de ajustar (itens, quantidades, data, local…). Nossa equipe retorna com uma nova versão.
          </p>
          <Textarea rows={5} value={changeMsg} onChange={(e) => setChangeMsg(e.target.value)}
            placeholder="Ex.: aumentar para 100 pessoas e incluir opção sem glúten." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequestChange} disabled={busy || !changeMsg.trim()}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdfOpen && id && (
        <PortalProposalPDF proposalId={id} onClose={() => setPdfOpen(false)} />
      )}
    </PortalLayout>
  );
}

function CoverItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">{icon}{label}</div>
      <div className="text-lg font-semibold mt-1 leading-tight">{value}</div>
    </div>
  );
}

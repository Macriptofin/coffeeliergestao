import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Check, Pencil, SquarePen, Download, MessageCircle, CalendarDays, Clock, Users, MapPin,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalClient } from '@/hooks/usePortalClient';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';
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

interface PortalProposalDetail {
  id: string; proposal_number: string; event_name: string | null; event_category: string | null;
  number_of_people: number | null; event_date: string | null; total_amount: number | null;
  status: string; created_by_client: boolean; payment_terms: string | null; notes: string | null;
  client_name: string | null; department_name: string | null; unit_name: string | null;
  room_name: string | null; event_location_name: string | null;
  is_umbrella: boolean; umbrella_quota_quantity: number | null;
  umbrella_quota_unit_price: number | null; consumed_quantity: number | null;
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

  const { data, isPending } = useQuery({
    queryKey: ['portal-proposal', id],
    enabled: !!id,
    queryFn: async (): Promise<PortalProposalDetail> => {
      const { data, error } = await supabase.rpc('get_portal_proposal', { p_proposal_id: id });
      if (error) throw error;
      return data as PortalProposalDetail;
    },
  });

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
      } else if (isPrazoMinimoMessage(r.message)) {
        showPrazoMinimoToast(r.message, { whatsappUrl, contactEmail });
      } else toast.error(r.message);
    } catch {
      toast.error('Não foi possível enviar a solicitação.');
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

  // Pedido que o próprio cliente montou já leva a aprovação do gestor dele por
  // fora do sistema (PDF impresso, botão "Imprimir proposta") antes de enviar —
  // não sobra um "Aprovar pedido" pendente aqui; "Enviada" já é só aguardar a
  // equipe Coffeelier analisar. O botão de aprovação continua existindo só pro
  // caso clássico: proposta que a EQUIPE monta e manda pro cliente aprovar.
  const isClientSubmittedPending = data.created_by_client && data.status === 'Enviada';
  const canApprove = !isClientSubmittedPending && data.status === 'Enviada' && portalClient?.portalRole === 'aprovador';
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

      <div className="grid lg:grid-cols-[1fr_340px] gap-7">
        {/* Coluna principal */}
        <div>
          <p className="text-muted-foreground text-sm mb-1.5">
            {[data.client_name, data.department_name].filter(Boolean).join(' · ')}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
            {data.event_name || data.event_category || 'Pedido'} · Proposta {data.proposal_number}
          </h1>

          {/* Capa do evento */}
          <div className="mt-5 rounded-2xl p-6 text-accent-creme shadow-warm grid grid-cols-2 sm:grid-cols-4 gap-5"
               style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
            <CoverItem icon={<CalendarDays className="h-4 w-4" />} label="Data"
              value={data.event_date ? formatLocalDate(data.event_date) : 'A definir'} />
            <CoverItem icon={<Clock className="h-4 w-4" />} label="Horário" value={firstTime || '—'} />
            <CoverItem icon={<Users className="h-4 w-4" />} label="Pessoas" value={String(data.number_of_people ?? '—')} />
            <CoverItem icon={<MapPin className="h-4 w-4" />} label="Local" value={localLabel} />
          </div>

          {/* Pedido recorrente: saldo da cota contratada */}
          {data.is_umbrella && (data.umbrella_quota_quantity ?? 0) > 0 && (() => {
            const quota = data.umbrella_quota_quantity!;
            const consumed = data.consumed_quantity ?? 0;
            const pct = Math.min(100, (consumed / quota) * 100);
            return (
              <div className="mt-5 bg-card border border-border/70 rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Contrato recorrente</h3>
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
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Consumido</p>
                    <p className="text-lg font-semibold">{consumed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Restante</p>
                    <p className="text-lg font-semibold text-primary">{Math.max(0, quota - consumed)}</p>
                  </div>
                </div>
              </div>
            );
          })()}

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

          {/* Momentos — cada composição com seu cabeçalho e seções */}
          <div className="mt-6 space-y-7">
            {(data.compositions || []).map((comp, ci) => {
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
          <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-soft">
            <div className="text-sm text-muted-foreground">Total do pedido</div>
            <div className="text-4xl font-bold mt-0.5">{formatCurrency(data.total_amount)}</div>
            {pricePerPerson != null && (
              <div className="text-muted-foreground text-sm mt-1">
                {formatCurrency(pricePerPerson)} por pessoa · {data.number_of_people} pessoas
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
              {!isApproved && !isClientSubmittedPending && !canApprove && data.status === 'Enviada' && (
                <p className="text-xs text-muted-foreground text-center">
                  Apenas um aprovador da sua empresa pode aprovar este pedido.
                </p>
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

          <a href={contactHref} target="_blank" rel="noopener noreferrer"
             className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline">
            <MessageCircle className="h-4 w-4" /> Falar com a Coffeelier
          </a>
        </div>
      </div>

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

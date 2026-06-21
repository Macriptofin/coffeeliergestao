import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageCircle, ChevronRight, Coffee, CalendarDays, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalClient } from '@/hooks/usePortalClient';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';
import { usePortalSettings } from '@/hooks/usePortalSettings';
import heroHome from '@/assets/portal/buffet-6.jpg';

interface PortalProposalRow {
  id: string; proposal_number: string; event_category: string | null;
  event_date: string | null; number_of_people: number | null;
  total_amount: number | null; status: string;
}

// Rótulo amigável + cor do status para o cliente.
function statusBadge(status: string) {
  switch (status) {
    case 'Enviada': return { label: 'Aguardando você', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Aprovada pelo Cliente': return { label: 'Em confirmação', cls: 'bg-accent-mocca/35 text-accent-coffee' };
    case 'Aprovada': return { label: 'Confirmada', cls: 'bg-primary/15 text-primary' };
    case 'Rejeitada': return { label: 'Recusada', cls: 'bg-destructive/15 text-destructive' };
    case 'Cancelada': return { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' };
    default: return { label: status, cls: 'bg-muted text-muted-foreground' };
  }
}

export default function PortalHome() {
  const navigate = useNavigate();
  const { portalClient } = usePortalClient();
  const { contactHref } = usePortalSettings();

  const { data: proposals = [], isPending } = useQuery({
    queryKey: ['portal-proposals'],
    queryFn: async (): Promise<PortalProposalRow[]> => {
      const { data, error } = await supabase.rpc('get_portal_proposals');
      if (error) throw error;
      return (data as PortalProposalRow[]) ?? [];
    },
  });

  return (
    <PortalLayout>
      <div className="relative rounded-3xl overflow-hidden shadow-warm">
        <img src={heroHome} alt="" className="w-full h-44 md:h-56 object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, hsl(20 54% 16% / .88), hsl(20 54% 20% / .55) 60%, hsl(20 54% 20% / .25))' }} />
        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-10 text-accent-creme">
          <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
            Bem-vindo de volta{portalClient?.clientName ? `, ${portalClient.clientName}` : ''}
          </h1>
          <p className="opacity-90 mt-1.5 max-w-md">
            Acompanhe seus pedidos e aprove suas propostas com tranquilidade.
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

      <h2 className="font-display text-2xl font-semibold mb-4">Meus pedidos</h2>

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
          {proposals.map((p) => {
            const badge = statusBadge(p.status);
            return (
              <button key={p.id} onClick={() => navigate(`/portal/proposta/${p.id}`)}
                className="w-full text-left bg-card border border-border/70 rounded-2xl p-5 md:p-6 flex items-center gap-5
                           shadow-soft hover:shadow-warm transition-shadow">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                     style={{ background: 'linear-gradient(135deg, hsl(34 52% 65%), hsl(34 88% 90%))' }}>
                  <Coffee className="h-6 w-6 text-accent-coffee" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">
                    {p.event_category || 'Pedido'} · Proposta {p.proposal_number}
                  </div>
                  <div className="text-muted-foreground text-sm mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />{p.event_date ? formatLocalDate(p.event_date) : 'A definir'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" />{p.number_of_people ?? '—'} pessoas
                    </span>
                  </div>
                </div>
                <div className="font-display text-xl font-semibold hidden sm:block">{formatCurrency(p.total_amount)}</div>
                <span className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}>
                  {badge.label}
                </span>
                <ChevronRight className="h-5 w-5 text-accent-mocca shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}

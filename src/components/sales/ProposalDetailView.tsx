import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Pencil, FileDown, CalendarDays, Clock, Users, MapPin, Wallet, Repeat,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';

interface Props {
  proposalId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onPdf?: (id: string) => void;
  onViewUmbrella?: (id: string) => void;
}

interface DetailItem { name: string; usage_unit: string | null; qty_per_person: number | null; fixed_qty: number | null; }
interface DetailSection { label: string; sort_order: number; items: DetailItem[]; }
interface DetailComposition {
  id: string; name: string | null; event_category: string | null;
  scheduled_date: string | null; scheduled_time: string | null;
  location: string | null; number_of_people: number | null; price_per_person: number | null;
  sections: DetailSection[];
}

// Rótulos amigáveis das seções (as keys internas são minúsculas: 'salgados'...)
const SECTION_LABELS: Record<string, string> = {
  salgados: 'Salgados', doces: 'Doces', light: 'Light', bebidas: 'Bebidas',
};
export const sectionLabel = (key: string) =>
  SECTION_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Itens');

const itemQty = (it: DetailItem) =>
  it.qty_per_person != null
    ? `${it.qty_per_person} ${it.usage_unit || 'un'} / pessoa`
    : `${it.fixed_qty ?? 0} ${it.usage_unit || 'un'}`;

async function fetchProposalDetail(proposalId: string) {
  const [propRes, compRes, catRes] = await Promise.all([
    supabase.from('proposals')
      .select(`*, clients(name, fantasy_name),
        client_departments:department_id(name), client_units:unit_id(name)`)
      .eq('id', proposalId).single(),
    supabase.from('proposal_compositions')
      .select('id, name, event_category, scheduled_date, scheduled_time, room_id, location, number_of_people, price_per_person, sort_order, client_rooms:room_id(name)')
      .eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('proposal_categories')
      .select('id, category_label, composition_id, sort_order, proposal_category_items(qty_per_person, fixed_qty, materials(name, usage_unit))')
      .eq('proposal_id', proposalId).order('sort_order'),
  ]);
  if (propRes.error) throw propRes.error;
  if (compRes.error) throw compRes.error;
  if (catRes.error) throw catRes.error;

  const prop = propRes.data as any;
  const cats = (catRes.data || []) as any[];

  const sectionsFor = (compositionId: string | null): DetailSection[] =>
    cats
      .filter(c => c.composition_id === compositionId)
      .map(c => ({
        label: sectionLabel(c.category_label),
        sort_order: c.sort_order,
        items: (c.proposal_category_items || []).map((i: any) => ({
          name: i.materials?.name || '—',
          usage_unit: i.materials?.usage_unit || null,
          qty_per_person: i.qty_per_person,
          fixed_qty: i.fixed_qty,
        })),
      }));

  const compositions: DetailComposition[] = ((compRes.data || []) as any[]).map(c => ({
    id: c.id,
    name: c.name,
    event_category: c.event_category,
    scheduled_date: c.scheduled_date,
    scheduled_time: c.scheduled_time,
    location: c.client_rooms?.name || c.location,
    number_of_people: c.number_of_people,
    price_per_person: c.price_per_person != null ? Number(c.price_per_person) : null,
    sections: sectionsFor(c.id),
  }));

  return { prop, compositions, legacySections: sectionsFor(null) };
}

// Visualização somente-leitura de proposta (mesma linguagem visual do portal),
// aberta com clique na linha da lista. Edição continua no ProposalEditor.
export function ProposalDetailView({ proposalId, onBack, onEdit, onPdf, onViewUmbrella }: Props) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['proposal-detail-view', proposalId],
    queryFn: () => fetchProposalDetail(proposalId),
  });

  if (isPending) {
    return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">Não foi possível carregar a proposta.</p>
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
      </div>
    );
  }

  const { prop, compositions, legacySections } = data;
  const isUmbrellaApproved = !!prop.is_umbrella && prop.status === 'Aprovada';
  const margin = prop.total_cost != null && prop.total_amount > 0
    ? (prop.total_amount - prop.total_cost) / prop.total_amount : null;
  const localLabel = [prop.client_units?.name].filter(Boolean).join(' · ')
    || prop.event_location_name || 'A definir';
  const firstTime = compositions[0]?.scheduled_time;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">
                {prop.event_name || prop.event_category || 'Proposta'} · {prop.proposal_number}
              </h2>
              {prop.is_umbrella && (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  <Repeat className="h-3 w-3 mr-1" /> Recorrente
                </Badge>
              )}
              <Badge variant="secondary">{prop.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {[prop.clients?.name, prop.client_departments?.name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isUmbrellaApproved && onViewUmbrella && (
            <Button variant="outline" onClick={() => onViewUmbrella(proposalId)}>
              <Wallet className="h-4 w-4 mr-2" /> Saldo e execuções
            </Button>
          )}
          {onPdf && (
            <Button variant="outline" onClick={() => onPdf(proposalId)}>
              <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
            </Button>
          )}
          {!isUmbrellaApproved && (
            <Button onClick={() => onEdit(proposalId)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Coluna principal */}
        <div className="space-y-6">
          {/* Capa */}
          <div className="rounded-2xl p-6 text-accent-creme shadow-warm grid grid-cols-2 sm:grid-cols-4 gap-5"
               style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
            <CoverItem icon={<CalendarDays className="h-4 w-4" />} label="Data"
              value={prop.event_date ? formatLocalDate(prop.event_date) : 'A definir'} />
            <CoverItem icon={<Clock className="h-4 w-4" />} label="Horário"
              value={firstTime ? String(firstTime).slice(0, 5) : '—'} />
            <CoverItem icon={<Users className="h-4 w-4" />} label="Pessoas" value={String(prop.number_of_people ?? '—')} />
            <CoverItem icon={<MapPin className="h-4 w-4" />} label="Local" value={localLabel} />
          </div>

          {/* Momentos */}
          {compositions.map((comp, ci) => {
            const meta = [
              comp.event_category,
              comp.scheduled_date ? formatLocalDate(comp.scheduled_date) : null,
              comp.scheduled_time ? String(comp.scheduled_time).slice(0, 5) : null,
              comp.location,
              comp.number_of_people ? `${comp.number_of_people} pessoas` : null,
              comp.price_per_person != null ? `${formatCurrency(comp.price_per_person)}/pessoa` : null,
            ].filter(Boolean).join(' · ');
            return (
              <div key={comp.id} className="space-y-3">
                <div className="border-l-4 border-primary pl-3">
                  <h3 className="text-lg font-semibold leading-tight">{comp.name || `Momento ${ci + 1}`}</h3>
                  {meta && <p className="text-sm text-muted-foreground mt-0.5">{meta}</p>}
                </div>
                {comp.sections.map((sec, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <h4 className="font-semibold mb-1">{sec.label}</h4>
                      {sec.items.map((it, j) => (
                        <div key={j} className="flex justify-between items-center py-2 border-t border-dashed border-border first:border-t-0 text-sm">
                          <span>{it.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">{itemQty(it)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}

          {/* Legado: seções sem composição (propostas antigas) */}
          {legacySections.length > 0 && legacySections.map((sec, i) => (
            <Card key={`legacy-${i}`}>
              <CardContent className="p-5">
                <h4 className="font-semibold mb-1">{sec.label}</h4>
                {sec.items.map((it, j) => (
                  <div key={j} className="flex justify-between items-center py-2 border-t border-dashed border-border first:border-t-0 text-sm">
                    <span>{it.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{itemQty(it)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {compositions.length === 0 && legacySections.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Esta proposta ainda não tem itens de cardápio.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Resumo comercial (visão interna: inclui custo/margem) */}
        <Card className="lg:sticky lg:top-6">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Valor total</div>
              <div className="text-3xl font-bold">{formatCurrency(prop.total_amount)}</div>
              {prop.number_of_people > 0 && (
                <div className="text-sm text-muted-foreground mt-0.5">
                  {formatCurrency((prop.total_amount || 0) / prop.number_of_people)} por pessoa · {prop.number_of_people} pessoas
                </div>
              )}
            </div>
            <div className="pt-3 border-t space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo total</span>
                <span>{prop.total_cost != null ? formatCurrency(prop.total_cost) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margem</span>
                <span className={margin == null ? '' : margin >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {margin == null ? '—' : formatPercent(margin)}
                </span>
              </div>
              {prop.is_umbrella && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cota contratada</span>
                  <span>
                    {prop.umbrella_quota_quantity ?? '—'}
                    {prop.umbrella_quota_unit_price != null ? ` × ${formatCurrency(prop.umbrella_quota_unit_price)}` : ''}
                  </span>
                </div>
              )}
              {prop.payment_terms && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cond. pagamento</span>
                  <span>{prop.payment_terms}</span>
                </div>
              )}
            </div>
            {prop.notes && (
              <div className="pt-3 border-t text-sm">
                <p className="text-muted-foreground mb-1">Observações</p>
                <p className="whitespace-pre-wrap">{prop.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoverItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs opacity-85">{icon}{label}</div>
      <div className="font-semibold mt-1 leading-snug">{value}</div>
    </div>
  );
}

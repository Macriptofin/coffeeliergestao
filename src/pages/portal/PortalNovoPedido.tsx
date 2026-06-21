import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, CalendarDays, Clock, Users, MapPin, Send, Coffee, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalClient } from '@/hooks/usePortalClient';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface CatalogItem {
  material_id: string; name: string; category: string | null; subcategory: string | null;
  unit: string | null; price: number;
}
interface Moment {
  localId: number; name: string; eventCategory: string; date: string; time: string;
  unitId: string; roomId: string; people: number | '';
  qty: Record<string, number>;
}

// Mesma lista de tipos do editor interno (mantém linguagem única).
const EVENT_CATEGORIES = [
  'Coffee Break', 'Brunch', 'Coquetel', 'Almoco',
  'Jantar', 'Festa Infantil', 'Casamento', 'Reuniao Corporativa',
];

let momentCounter = 1;
const emptyMoment = (): Moment => ({
  localId: momentCounter++, name: '', eventCategory: '', date: '', time: '', unitId: '', roomId: '', people: '', qty: {},
});

export default function PortalNovoPedido() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get('draft') || '';
  const { portalClient } = usePortalClient();
  const clientId = portalClient?.clientId;

  const [eventName, setEventName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [defaultPeople, setDefaultPeople] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [moments, setMoments] = useState<Moment[]>([emptyMoment()]);
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);

  const { data: catalog = [] } = useQuery({
    queryKey: ['portal-catalog'],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase.rpc('get_portal_catalog');
      if (error) throw error;
      return (data as CatalogItem[]) ?? [];
    },
  });
  const units = useQuery({
    queryKey: ['portal-units', clientId], enabled: !!clientId,
    queryFn: async () => (await supabase.from('client_units').select('id, name').eq('client_id', clientId!).eq('is_active', true)).data ?? [],
  });
  const departments = useQuery({
    queryKey: ['portal-departments', clientId], enabled: !!clientId,
    queryFn: async () => (await supabase.from('client_departments').select('id, name').eq('client_id', clientId!).eq('is_active', true)).data ?? [],
  });
  const rooms = useQuery({
    queryKey: ['portal-rooms', clientId], enabled: !!clientId,
    queryFn: async () => (await supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', clientId!).eq('is_active', true)).data ?? [],
  });

  // Carrega rascunho para edição (?draft=<id>).
  const { data: draft } = useQuery({
    queryKey: ['portal-draft', draftId], enabled: !!draftId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_portal_proposal', { p_proposal_id: draftId });
      if (error) throw error;
      return data as any;
    },
  });
  useEffect(() => {
    if (!draft || draft.error || prefilled.current) return;
    prefilled.current = true;
    setEventName(draft.event_name || draft.event_category || '');
    setDepartmentId(draft.department_id || '');
    setDefaultPeople(draft.number_of_people || '');
    setNotes(draft.notes || '');
    const comps = (draft.compositions || []) as any[];
    if (comps.length > 0) {
      setMoments(comps.map((c) => {
        const qty: Record<string, number> = {};
        (c.categories || []).forEach((sec: any) => (sec.items || []).forEach((it: any) => {
          if (it.material_id && it.qty_per_person != null) qty[it.material_id] = Math.round(Number(it.qty_per_person));
        }));
        return {
          localId: momentCounter++, name: c.name || '', eventCategory: c.event_category || '',
          date: c.scheduled_date || '',
          time: (c.scheduled_time || '').slice(0, 5), unitId: c.unit_id || '', roomId: c.room_id || '',
          people: c.number_of_people || '', qty,
        } as Moment;
      }));
    }
  }, [draft]);

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of catalog) { const k = it.category || 'Outros'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(it); }
    return Array.from(m.entries());
  }, [catalog]);

  const priceOf = (id: string) => catalog.find(c => c.material_id === id)?.price || 0;
  const momentPeople = (mt: Moment) => Number(mt.people || defaultPeople || 0);
  const momentTotal = (mt: Moment) =>
    Object.entries(mt.qty).reduce((s, [id, q]) => s + (q || 0) * priceOf(id) * momentPeople(mt), 0);
  const total = moments.reduce((s, mt) => s + momentTotal(mt), 0);

  const patchMoment = (localId: number, patch: Partial<Moment>) =>
    setMoments(prev => prev.map(m => m.localId === localId ? { ...m, ...patch } : m));
  // Quantidades SEMPRE inteiras (sem fração) — evita quebra na produção.
  const setQty = (localId: number, materialId: string, value: string) => {
    const n = Math.max(0, Math.floor(Number(value.replace(/[^\d]/g, '')) || 0));
    setMoments(prev => prev.map(m => m.localId === localId ? { ...m, qty: { ...m.qty, [materialId]: n } } : m));
  };

  const buildPayload = (status: 'Rascunho' | 'Enviada') => {
    const unitName = (id: string) => units.data?.find((u: any) => u.id === id)?.name;
    const roomName = (id: string) => rooms.data?.find((r: any) => r.id === id)?.name;
    const compositions = moments.map((mt, i) => {
      const byCat = new Map<string, { material_id: string; qty_per_person: number }[]>();
      for (const it of catalog) {
        const q = mt.qty[it.material_id] || 0; if (q <= 0) continue;
        const k = it.category || 'Outros';
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k)!.push({ material_id: it.material_id, qty_per_person: q });
      }
      return {
        name: mt.name.trim() || `Momento ${i + 1}`,
        event_category: mt.eventCategory || null,
        scheduled_date: mt.date || null, scheduled_time: mt.time || null,
        unit_id: mt.unitId || null, room_id: mt.roomId || null,
        location: [unitName(mt.unitId), roomName(mt.roomId)].filter(Boolean).join(' · ') || null,
        number_of_people: momentPeople(mt),
        sections: Array.from(byCat.entries()).map(([category_label, items]) => ({ category_label, items })),
      };
    });
    const first = moments[0];
    return {
      proposal_id: draftId || null, status,
      number_of_people: Number(defaultPeople || first?.people || 0),
      event_date: first?.date || null,
      event_name: eventName.trim(),
      event_category: first?.eventCategory || null, // legado: tipo do 1º momento
      notes: notes.trim() || null,
      unit_id: first?.unitId || null, department_id: departmentId || null, room_id: first?.roomId || null,
      compositions,
    };
  };

  const save = async (status: 'Rascunho' | 'Enviada') => {
    if (!eventName.trim()) { toast.error('Dê um nome ao evento.'); return; }
    if (status === 'Enviada') {
      const ok = moments.every(m => m.eventCategory && m.date && momentPeople(m) > 0 && Object.values(m.qty).some(q => q > 0));
      if (!ok) { toast.error('Para enviar: cada momento precisa de tipo, data, nº de pessoas e ao menos um item.'); return; }
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_portal_order', { p_payload: buildPayload(status) });
      if (error) throw error;
      const r = data as { success: boolean; message: string };
      if (!r.success) { toast.error(r.message); return; }
      toast.success(r.message);
      navigate('/portal', { replace: true });
    } catch {
      toast.error('Não foi possível salvar o pedido. Tente novamente.');
    } finally { setSubmitting(false); }
  };

  return (
    <PortalLayout>
      <button onClick={() => navigate('/portal')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">
        {draftId ? 'Continuar rascunho' : 'Montar um novo pedido'}
      </h1>
      <p className="text-muted-foreground mt-2">Crie um ou mais momentos (ex.: welcome, coffee da tarde), cada um com seu local, horário e itens.</p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-7 mt-7">
        <div className="space-y-6">
          {/* Dados gerais */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-4">Dados gerais</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome do evento</Label>
                <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex.: Convenção Anual · Diretoria" />
              </div>
              <div className="space-y-1.5">
                <Label>Departamento solicitante</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{(departments.data || []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Pessoas (padrão)</Label>
                <Input type="number" min={1} step={1} value={defaultPeople} onChange={e => setDefaultPeople(parseInt(e.target.value) || '')} placeholder="usado nos momentos" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Observações (opcional)</Label>
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Restrições, preferências, detalhes…" />
              </div>
            </div>
          </div>

          {/* Momentos */}
          {moments.map((mt, idx) => (
            <div key={mt.localId} className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">Momento {idx + 1}</h2>
                {moments.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-destructive gap-1"
                    onClick={() => setMoments(prev => prev.filter(m => m.localId !== mt.localId))}>
                    <Trash2 className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome do momento</Label>
                  <Input value={mt.name} onChange={e => patchMoment(mt.localId, { name: e.target.value })} placeholder="Ex.: Welcome Coffee" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Coffee className="h-4 w-4" /> Tipo de evento</Label>
                  <Select value={mt.eventCategory} onValueChange={(v) => patchMoment(mt.localId, { eventCategory: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{EVENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Data</Label>
                  <Input type="date" value={mt.date} onChange={e => patchMoment(mt.localId, { date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Horário</Label>
                  <Input type="time" value={mt.time} onChange={e => patchMoment(mt.localId, { time: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Unidade</Label>
                  <Select value={mt.unitId} onValueChange={(v) => patchMoment(mt.localId, { unitId: v, roomId: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{(units.data || []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sala</Label>
                  <Select value={mt.roomId} onValueChange={(v) => patchMoment(mt.localId, { roomId: v })} disabled={!mt.unitId}>
                    <SelectTrigger><SelectValue placeholder={mt.unitId ? 'Selecionar' : 'Escolha a unidade'} /></SelectTrigger>
                    <SelectContent>
                      {(rooms.data || []).filter((r: any) => r.unit_id === mt.unitId).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Pessoas neste momento</Label>
                  <Input type="number" min={1} step={1} value={mt.people} onChange={e => patchMoment(mt.localId, { people: parseInt(e.target.value) || '' })} placeholder={defaultPeople ? String(defaultPeople) : ''} />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium mb-2">Itens <span className="text-muted-foreground font-normal">(quantidade inteira por pessoa)</span></div>
                {grouped.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Seu catálogo ainda não tem itens. Fale com a Coffeelier.</p>
                ) : grouped.map(([cat, items]) => (
                  <div key={cat} className="mb-3 last:mb-0">
                    <div className="font-display font-semibold text-sm mb-1">{cat}</div>
                    {items.map(it => (
                      <div key={it.material_id} className="flex items-center gap-3 py-1.5 border-t border-dashed border-border first:border-t-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(it.price)} / {it.unit || 'un'}</div>
                        </div>
                        <Input type="number" min={0} step={1} inputMode="numeric" className="w-20 h-9"
                          value={mt.qty[it.material_id] ?? ''} placeholder="0"
                          onChange={e => setQty(mt.localId, it.material_id, e.target.value)} />
                        <span className="text-xs text-muted-foreground w-12">/pessoa</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="text-right text-sm text-muted-foreground mt-2">Subtotal do momento: <strong className="text-foreground">{formatCurrency(momentTotal(mt))}</strong></div>
              </div>
            </div>
          ))}

          <Button variant="outline" className="w-full h-12 rounded-2xl gap-2 border-dashed"
            onClick={() => setMoments(prev => [...prev, emptyMoment()])}>
            <Plus className="h-5 w-5" /> Adicionar outro momento
          </Button>
        </div>

        {/* Resumo */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-soft">
            <div className="text-sm text-muted-foreground">Total estimado</div>
            <div className="font-display text-4xl font-bold mt-0.5">{formatCurrency(total)}</div>
            <div className="text-muted-foreground text-sm mt-1">{moments.length} momento(s)</div>
            <Button onClick={() => save('Enviada')} disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold text-accent-creme shadow-warm gap-2 mt-5"
              style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
              <Send className="h-5 w-5" /> {submitting ? 'Enviando…' : 'Enviar pedido'}
            </Button>
            <Button onClick={() => save('Rascunho')} disabled={submitting} variant="outline"
              className="w-full h-11 rounded-xl gap-2 mt-3">
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
            <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed">
              <Coffee className="h-3.5 w-3.5 inline mr-1" />
              Salve como rascunho para continuar depois. Ao enviar, a equipe Coffeelier revisa, confirma e devolve a proposta final.
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

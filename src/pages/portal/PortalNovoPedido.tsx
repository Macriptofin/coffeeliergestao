import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CalendarDays, Clock, Users, MapPin, Send, Coffee } from 'lucide-react';
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

export default function PortalNovoPedido() {
  const navigate = useNavigate();
  const { portalClient } = usePortalClient();
  const clientId = portalClient?.clientId;

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [people, setPeople] = useState<number>(0);
  const [unitId, setUnitId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({}); // material_id -> qtd/pessoa
  const [submitting, setSubmitting] = useState(false);

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
    queryKey: ['portal-rooms', clientId, unitId], enabled: !!clientId,
    queryFn: async () => {
      let q = supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', clientId!).eq('is_active', true);
      if (unitId) q = q.eq('unit_id', unitId);
      return (await q).data ?? [];
    },
  });

  // Catálogo agrupado por categoria.
  const grouped = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of catalog) {
      const k = it.category || 'Outros';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [catalog]);

  const total = useMemo(() => {
    return catalog.reduce((sum, it) => sum + (qty[it.material_id] || 0) * it.price * (people || 0), 0);
  }, [catalog, qty, people]);

  const selectedCount = Object.values(qty).filter(q => q > 0).length;

  const submit = async () => {
    if (!eventName.trim()) { toast.error('Dê um nome ao evento (ex.: Coffee Break Diretoria).'); return; }
    if (!eventDate) { toast.error('Informe a data do evento.'); return; }
    if (!people || people <= 0) { toast.error('Informe o número de pessoas.'); return; }
    if (selectedCount === 0) { toast.error('Selecione ao menos um produto.'); return; }

    // Monta seções por categoria com os itens escolhidos.
    const byCat = new Map<string, { material_id: string; qty_per_person: number }[]>();
    for (const it of catalog) {
      const q = qty[it.material_id] || 0;
      if (q <= 0) continue;
      const k = it.category || 'Outros';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push({ material_id: it.material_id, qty_per_person: q });
    }
    const locationName = [units.data?.find((u: any) => u.id === unitId)?.name,
                          rooms.data?.find((r: any) => r.id === roomId)?.name].filter(Boolean).join(' · ');

    const payload = {
      number_of_people: people, event_date: eventDate, event_category: eventName.trim(),
      notes: notes.trim() || null, unit_id: unitId || null, department_id: departmentId || null, room_id: roomId || null,
      compositions: [{
        name: eventName.trim(), scheduled_date: eventDate, scheduled_time: eventTime || null,
        location: locationName || null, number_of_people: people,
        sections: Array.from(byCat.entries()).map(([category_label, items]) => ({ category_label, items })),
      }],
    };

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_portal_order', { p_payload: payload });
      if (error) throw error;
      const r = data as { success: boolean; message: string; proposal_id?: string };
      if (!r.success) { toast.error(r.message); return; }
      toast.success(r.message);
      navigate('/portal', { replace: true });
    } catch {
      toast.error('Não foi possível enviar o pedido. Tente novamente.');
    } finally { setSubmitting(false); }
  };

  return (
    <PortalLayout>
      <button onClick={() => navigate('/portal')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight">Montar um novo pedido</h1>
      <p className="text-muted-foreground mt-2">Escolha quando, onde e o que servir. Nossa equipe revisa e confirma.</p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-7 mt-7">
        <div className="space-y-6">
          {/* Dados do evento */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-4">Dados do evento</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome do evento</Label>
                <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Ex.: Coffee Break · Reunião Diretoria" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> Data</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Horário</Label>
                <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Pessoas</Label>
                <Input type="number" min={1} value={people || ''} onChange={e => setPeople(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Unidade</Label>
                <Select value={unitId} onValueChange={(v) => { setUnitId(v); setRoomId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{(units.data || []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{(departments.data || []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sala</Label>
                <Select value={roomId} onValueChange={setRoomId} disabled={!unitId}>
                  <SelectTrigger><SelectValue placeholder={unitId ? 'Selecionar' : 'Escolha a unidade'} /></SelectTrigger>
                  <SelectContent>{(rooms.data || []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Restrições, preferências, detalhes do local…" />
            </div>
          </div>

          {/* Cardápio */}
          <div className="bg-card border border-border/70 rounded-2xl p-5 md:p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-1">Escolha os itens</h2>
            <p className="text-sm text-muted-foreground mb-4">Defina a quantidade <strong>por pessoa</strong> de cada item.</p>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Seu catálogo ainda não tem itens. Fale com a Coffeelier.</p>
            ) : grouped.map(([cat, items]) => (
              <div key={cat} className="mb-5 last:mb-0">
                <div className="font-display font-semibold mb-2">{cat}</div>
                <div className="space-y-1">
                  {items.map(it => (
                    <div key={it.material_id} className="flex items-center gap-3 py-2 border-t border-dashed border-border first:border-t-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(it.price)} / {it.unit || 'un'}</div>
                      </div>
                      <Input type="number" min={0} step="0.1" className="w-24 h-9"
                        value={qty[it.material_id] ?? ''} placeholder="0"
                        onChange={e => setQty(prev => ({ ...prev, [it.material_id]: parseFloat(e.target.value) || 0 }))} />
                      <span className="text-xs text-muted-foreground w-12">/pessoa</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-soft">
            <div className="text-sm text-muted-foreground">Total estimado</div>
            <div className="font-display text-4xl font-bold mt-0.5">{formatCurrency(total)}</div>
            <div className="text-muted-foreground text-sm mt-1">
              {selectedCount} item(ns) · {people || 0} pessoas
            </div>
            <Button onClick={submit} disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold text-accent-creme shadow-warm gap-2 mt-5"
              style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
              <Send className="h-5 w-5" /> {submitting ? 'Enviando…' : 'Enviar pedido'}
            </Button>
            <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed">
              <Coffee className="h-3.5 w-3.5 inline mr-1" />
              Valor estimado pelo catálogo. A equipe Coffeelier revisa, confirma e devolve a proposta final.
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

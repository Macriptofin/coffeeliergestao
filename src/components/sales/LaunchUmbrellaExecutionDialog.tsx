import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { todayLocalISO } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  proposalId: string;
  clientId: string;
  eventName: string | null;
  /** Preço efetivo da proposta matriz (cota, senão o do molde) — só exibição. */
  matrixUnitPrice: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunched: () => void;
}

interface ClientUnit { id: string; name: string; }
interface ClientRoom { id: string; name: string; unit_id: string; }

// Estrutura do cliente (unidades/prédios e salas) pro agendamento da execução.
async function fetchClientStructure(clientId: string) {
  const [unitsRes, roomsRes] = await Promise.all([
    supabase.from('client_units').select('id, name').eq('client_id', clientId).eq('is_active', true).order('name'),
    supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', clientId).eq('is_active', true).order('name'),
  ]);
  if (unitsRes.error) throw unitsRes.error;
  if (roomsRes.error) throw roomsRes.error;
  return {
    units: (unitsRes.data || []) as ClientUnit[],
    rooms: (roomsRes.data || []) as ClientRoom[],
  };
}

// Lança uma execução nova numa proposta guarda-chuva já aprovada, via
// add_umbrella_execution (RPC aditiva — nunca apaga nada existente; ver
// migration 20260818190000_add_umbrella_proposal_support.sql).
export function LaunchUmbrellaExecutionDialog({ proposalId, clientId, eventName, matrixUnitPrice, open, onOpenChange, onLaunched }: Props) {
  const [name, setName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayLocalISO());
  const [scheduledTime, setScheduledTime] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState<number | ''>('');
  const [unitId, setUnitId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: structure } = useQuery({
    queryKey: ['umbrella-client-structure', clientId],
    queryFn: () => fetchClientStructure(clientId),
    enabled: open && !!clientId,
  });
  const units = structure?.units ?? [];
  const rooms = structure?.rooms ?? [];
  const filteredRooms = unitId ? rooms.filter(r => r.unit_id === unitId) : rooms;

  useEffect(() => {
    if (!open) return;
    // Nome sugerido: "<Nome do evento> — <Mês>" (ex.: "Onboarding — Agosto")
    const month = format(new Date(), 'MMMM', { locale: ptBR });
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
    setName(eventName ? `${eventName} — ${monthCap}` : '');
    setScheduledDate(todayLocalISO());
    setScheduledTime('');
    setNumberOfPeople('');
    setUnitId('');
    setRoomId('');
    setNotes('');
  }, [open, eventName]);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Informe um nome pra execução (ex: nome da visita, ou o mês).'); return; }
    if (!scheduledDate) { toast.error('Informe a data.'); return; }
    if (!numberOfPeople || numberOfPeople <= 0) { toast.error('Informe o nº de pessoas.'); return; }

    setSubmitting(true);
    try {
      // p_price_per_person sempre null: o preço obedece a proposta matriz
      // (cota → molde), resolvido pela própria RPC — nunca editado aqui.
      const { error } = await supabase.rpc('add_umbrella_execution', {
        p_proposal_id: proposalId,
        p_name: name.trim(),
        p_scheduled_date: scheduledDate,
        p_scheduled_time: scheduledTime || null,
        p_number_of_people: numberOfPeople,
        p_price_per_person: null,
        p_room_id: roomId || null,
        p_location: null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      toast.success('Execução lançada! Evento criado na agenda.');
      onLaunched();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao lançar execução: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar execução</DialogTitle>
          <DialogDescription>
            Cria um evento na agenda e a separação/produção necessária, abatendo da cota.
            O cardápio é copiado da composição original — ajuste depois se precisar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome da execução *</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Coffee break - Agosto momento 1, Visita Faculdade X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nº de pessoas *</Label>
              <Input type="number" min="1" value={numberOfPeople}
                onChange={e => setNumberOfPeople(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço/pessoa</Label>
              {/* Travado: obedece sempre a proposta matriz (cota → molde) */}
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground">
                {matrixUnitPrice != null ? `${formatCurrency(matrixUnitPrice)} (da proposta)` : 'definido pela proposta'}
              </div>
            </div>
          </div>

          {/* Estrutura do cliente: prédio/unidade filtra as salas disponíveis */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade / Prédio</Label>
              <Select value={unitId} onValueChange={(v) => { setUnitId(v); setRoomId(''); }} disabled={!units.length}>
                <SelectTrigger>
                  <SelectValue placeholder={units.length ? 'Selecione' : 'Nenhuma cadastrada'} />
                </SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sala</Label>
              <Select value={roomId} onValueChange={setRoomId} disabled={!filteredRooms.length}>
                <SelectTrigger>
                  <SelectValue placeholder={filteredRooms.length ? 'Selecione' : 'Nenhuma disponível'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Informações adicionais da execução..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Lançando...</> : 'Lançar execução'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

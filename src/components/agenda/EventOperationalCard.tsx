import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Calendar, Users, MapPin, DollarSign, Clock,
  ClipboardList, CheckCircle2, ChevronDown, ChevronUp,
  ArrowRight, AlertCircle, Package, Edit
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  task: string;
  is_completed: boolean;
  assigned_to?: string;
}

interface EventOPCard {
  id:           string;
  event_name:   string;
  event_date:   string;
  setup_time?:  string;
  status:       string;
  venue?:       string;
  total_people: number;
  total_amount: number;
  proposal_id?: string;
  client_name?: string;
  proposal_number?: string;
  proposal_status?: string;
  op_id?:       string;
  op_status?:   string;
  op_name?:     string;
}

interface Props {
  event:    EventOPCard;
  onEdit:   () => void;
  onRefresh:() => void;
}

// ─── Pipeline de Status ────────────────────────────────────────────────────────

const PIPELINE = [
  { key: 'proposta',  label: 'Proposta',   statuses: ['rascunho','enviada','aprovada'] },
  { key: 'op',        label: 'Produção',   statuses: ['Planejado','Em Produção'] },
  { key: 'evento',    label: 'Evento',     statuses: ['Agendado','Em Preparação','Em Andamento'] },
  { key: 'concluido', label: 'Concluído',  statuses: ['Concluído'] },
];

const getActiveStep = (event: EventOPCard): number => {
  if (['Concluído'].includes(event.status)) return 3;
  if (['Em Andamento','Em Preparação'].includes(event.status)) return 2;
  if (event.op_status && ['Em Produção','Concluído'].includes(event.op_status)) return 1;
  if (event.proposal_status === 'aprovada' || event.op_id) return 1;
  return 0;
};

const STATUS_COLORS: Record<string, string> = {
  'Agendado':      'bg-blue-100 text-blue-800 border-blue-200',
  'Em Preparação': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Em Andamento':  'bg-orange-100 text-orange-800 border-orange-200',
  'Concluído':     'bg-green-100 text-green-800 border-green-200',
  'Cancelado':     'bg-red-100 text-red-800 border-red-200',
};

const OP_STATUS_LABELS: Record<string, string> = {
  Planejado:    'Pendente',
  'Em Produção': 'Em produção',
  Concluído:    'Concluída',
  Cancelado:    'Cancelada',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const daysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  const eventDay = new Date(y, m - 1, d);
  return Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
};

// ─── Componente ────────────────────────────────────────────────────────────────

export function EventOperationalCard({ event, onEdit, onRefresh }: Props) {
  const navigate = useNavigate();
  const [expanded,  setExpanded]  = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newTask,   setNewTask]   = useState('');
  const [loading,   setLoading]   = useState(false);

  const days    = daysUntil(event.event_date);
  const step    = getActiveStep(event);
  const isToday = days === 0;
  const isPast  = days < 0;

  useEffect(() => {
    if (expanded) loadChecklist();
  }, [expanded]);

  const loadChecklist = async () => {
    const { data } = await supabase
      .from('event_checklist')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at');
    setChecklist((data || []) as unknown as ChecklistItem[]);
  };

  const toggleItem = async (item: ChecklistItem) => {
    await supabase.from('event_checklist').update({ is_completed: !item.is_completed }).eq('id', item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_completed: !c.is_completed } : c));
  };

  const addItem = async () => {
    if (!newTask.trim()) return;
    const { data } = await (supabase as any).from('event_checklist').insert({ event_id: event.id, task: newTask.trim(), is_completed: false }).select().single();
    if (data) { setChecklist(prev => [...prev, data as ChecklistItem]); setNewTask(''); }
  };

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', event.id);
    if (!error) { toast.success(`Status atualizado: ${newStatus}`); onRefresh(); }
    setLoading(false);
  };

  const completedChecklist = checklist.filter(c => c.is_completed).length;

  return (
    <div className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
      isToday ? 'border-primary ring-1 ring-primary' : isPast ? 'opacity-70' : 'border-border'
    }`}>
      {/* Header */}
      <div className="p-4 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-base truncate">{event.event_name}</h3>
              <Badge className={STATUS_COLORS[event.status] || 'bg-muted text-muted-foreground'}>
                {event.status}
              </Badge>
              {isToday && <Badge className="bg-primary text-primary-foreground text-xs">Hoje</Badge>}
              {event.proposal_number && (
                <Badge variant="outline" className="text-xs">{event.proposal_number}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {fmtDate(event.event_date)}
                {event.setup_time && ` · ${event.setup_time}`}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {event.total_people} pessoas
              </span>
              {event.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue}
                </span>
              )}
              {event.client_name && (
                <span className="text-muted-foreground">{event.client_name}</span>
              )}
            </div>
          </div>

          {/* Contador + Valor */}
          <div className="text-right flex-shrink-0">
            {!isPast && (
              <div className={`text-lg font-bold mb-0.5 ${
                days === 0 ? 'text-primary' : days <= 3 ? 'text-orange-600' : days <= 7 ? 'text-yellow-600' : 'text-muted-foreground'
              }`}>
                {days === 0 ? '🔥 Hoje' : days === 1 ? 'Amanhã' : `${days}d`}
              </div>
            )}
            {event.total_amount > 0 && (
              <div className="text-sm font-semibold text-primary">{fmt(event.total_amount)}</div>
            )}
          </div>
        </div>

        {/* Pipeline de Status */}
        <div className="mt-3 flex items-center gap-1">
          {PIPELINE.map((p, i) => (
            <div key={p.key} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`flex-1 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                i <= step ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {i < step && <CheckCircle2 className="h-3 w-3 flex-shrink-0" />}
                {i === step && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />}
                <span className="truncate">{p.label}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <ArrowRight className={`h-3 w-3 flex-shrink-0 ${i < step ? 'text-primary' : 'text-muted-foreground/40'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Status da OP */}
        {event.op_id && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">OP:</span>
            <span className={`font-medium ${
              event.op_status === 'Concluído' ? 'text-green-600' :
              event.op_status === 'Em Produção' ? 'text-orange-600' : 'text-muted-foreground'
            }`}>
              {OP_STATUS_LABELS[event.op_status || ''] || event.op_status}
            </span>
            <button
              onClick={() => navigate('/producao/planejamento')}
              className="text-primary underline hover:no-underline"
            >
              Ver OP
            </button>
          </div>
        )}
        {!event.op_id && event.status !== 'Cancelado' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Sem ordem de produção vinculada
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="px-4 py-2 bg-muted/30 border-t flex items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {/* Atualizar status */}
          {event.status === 'Agendado' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}
              onClick={() => updateStatus('Em Preparação')}>
              Iniciar Preparação
            </Button>
          )}
          {event.status === 'Em Preparação' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}
              onClick={() => updateStatus('Em Andamento')}>
              Evento Iniciado
            </Button>
          )}
          {event.status === 'Em Andamento' && (
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" disabled={loading}
              onClick={() => updateStatus('Concluído')}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
            <Edit className="h-3 w-3 mr-1" /> Editar
          </Button>
        </div>

        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setExpanded(!expanded)}>
          <ClipboardList className="h-3.5 w-3.5" />
          Checklist
          {checklist.length > 0 && (
            <span className="text-muted-foreground">({completedChecklist}/{checklist.length})</span>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Checklist expansível */}
      {expanded && (
        <div className="px-4 py-3 border-t bg-card space-y-2">
          {checklist.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhuma tarefa ainda. Adicione abaixo.
            </p>
          )}
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.is_completed}
                onChange={() => toggleItem(item)}
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <span className={`text-sm flex-1 ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                {item.task}
              </span>
            </div>
          ))}
          {/* Adicionar tarefa */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Nova tarefa..."
              className="flex-1 text-xs border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>
              Adicionar
            </Button>
          </div>
          {checklist.length > 0 && (
            <div className="text-xs text-muted-foreground pt-1">
              {completedChecklist} de {checklist.length} tarefas concluídas
            </div>
          )}
        </div>
      )}
    </div>
  );
}

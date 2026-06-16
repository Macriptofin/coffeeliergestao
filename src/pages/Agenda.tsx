import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { Calendar, Clock, Users, MapPin, Bell, LayoutList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EventsList } from '@/components/agenda/EventsList';
import { EventCalendar } from '@/components/agenda/EventCalendar';
import { EventForm } from '@/components/agenda/EventForm';
import { EventNotifications } from '@/components/agenda/EventNotifications';
import { EventOperationalCard } from '@/components/agenda/EventOperationalCard';
import { useUserRole } from '@/hooks/useUserRole';

interface Event {
  id: string;
  proposal_id?: string;
  client_id: string;
  event_name: string;
  event_date: string;
  setup_time?: string;
  event_duration: number;
  status: string;
  venue?: string;
  contact_person?: string;
  contact_phone?: string;
  total_people: number;
  total_weight: number;
  total_amount: number;
  setup_notes?: string;
  special_requirements?: string;
  created_at: string;
  updated_at: string;
  clients?: { name: string };
  // Dados enriquecidos (buscados separadamente)
  proposal_number?: string;
  proposal_status?: string;
  op_id?: string;
  op_status?: string;
  op_name?: string;
}

async function fetchEvents(): Promise<Event[]> {
  // Buscar eventos com dados de cliente
  const { data: eventsData, error } = await supabase
    .from('events')
    .select('*, clients:client_id(name)')
    .order('event_date', { ascending: true });

  if (error) throw error;

  const evts = eventsData || [];

  // Enriquecer com dados de proposta e OP
  const proposalIds = [...new Set(evts.filter(e => e.proposal_id).map(e => e.proposal_id as string))];

  const proposalMap: Record<string, { proposal_number: string; status: string; auto_generated_bom_order_id?: string }> = {};
  const opMap: Record<string, { id: string; status: string; order_name: string }> = {};

  if (proposalIds.length > 0) {
    const { data: props } = await supabase
      .from('proposals')
      .select('id, proposal_number, status, auto_generated_bom_order_id')
      .in('id', proposalIds);

    (props || []).forEach(p => { proposalMap[p.id] = p; });

    const opIds = [...new Set((props || []).filter(p => p.auto_generated_bom_order_id).map(p => p.auto_generated_bom_order_id as string))];
    if (opIds.length > 0) {
      const { data: ops } = await supabase
        .from('bom_production_orders')
        .select('id, status, order_name')
        .in('id', opIds);
      (ops || []).forEach(o => { opMap[o.id] = o; });
    }
  }

  const enriched: Event[] = evts.map(e => {
    const prop = e.proposal_id ? proposalMap[e.proposal_id] : undefined;
    const op   = prop?.auto_generated_bom_order_id ? opMap[prop.auto_generated_bom_order_id] : undefined;
    return {
      ...e,
      proposal_number: prop?.proposal_number,
      proposal_status: prop?.status,
      op_id:     op?.id,
      op_status: op?.status,
      op_name:   op?.order_name,
    };
  });

  return enriched;
}

export default function Agenda() {
  const queryClient = useQueryClient();
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { userRole, isAdminOrManager, loading: roleLoading } = useUserRole();

  const canAccess = isAdminOrManager();

  const {
    data: events = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    enabled: !roleLoading && canAccess,
  });

  // Enquanto o papel do usuário carrega (ou se a query está habilitada e pendente),
  // mantemos o gate de loading. Usuário sem acesso não dispara loading.
  const loading = roleLoading || (canAccess && isPending);
  const showLoader = useDelayedLoading(loading);

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar eventos');
      toast.error('Erro ao carregar eventos');
    }
  }, [isError]);

  // Após mutações (criar/editar/excluir/mudar status), invalida a query de eventos
  const refetchEvents = () => queryClient.invalidateQueries({ queryKey: ['events'] });

  const handleEventSuccess = () => {
    setShowEventForm(false);
    setEditingEvent(null);
    setSelectedDateForNewEvent(undefined);
    refetchEvents();
    toast.success(editingEvent ? 'Evento atualizado!' : 'Evento criado!');
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      refetchEvents();
      toast.success('Evento excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir evento:', error);
      toast.error('Erro ao excluir evento');
    }
  };

  if (!isAdminOrManager()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar a agenda de eventos.
          </p>
        </div>
      </div>
    );
  }

  if (showLoader) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Carregando agenda...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      'Agendado': 'default',
      'Em Preparação': 'secondary',
      'Em Andamento': 'outline',
      'Concluído': 'default',
      'Cancelado': 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status}
      </Badge>
    );
  };

  const upcomingEvents = events.filter(event => {
    if (event.status === 'Cancelado') return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Parse da data do evento como data local (evita problemas de timezone)
    const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number);
    const eventDay = new Date(year, month - 1, day);
    
    // Evento é de um dia futuro - incluir
    if (eventDay > today) return true;
    
    // Evento é de hoje - considerar horário se disponível
    if (eventDay.getTime() === today.getTime()) {
      // Se tem horário de setup, verificar se já passou
      if (event.setup_time) {
        const [hours, minutes] = event.setup_time.split(':').map(Number);
        const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return eventDateTime >= now;
      }
      // Se não tem horário, incluir todos os eventos de hoje
      return true;
    }
    
    return false;
  }).slice(0, 5);

  const todayEvents = events.filter(event => {
    if (event.status === 'Cancelado') return false;
    const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number);
    const eventDay = new Date(year, month - 1, day);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return eventDay.getTime() === todayStart.getTime();
  });

  const thisWeekEvents = events.filter(event => {
    if (event.status === 'Cancelado') return false;
    const [year, month, day] = event.event_date.split('T')[0].split('-').map(Number);
    const eventDay = new Date(year, month - 1, day);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const oneWeekFromNow = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return eventDay >= todayStart && eventDay <= oneWeekFromNow;
  });

  const thisMonthEvents = events.filter(event => {
    if (event.status === 'Cancelado') return false;
    const [year, month] = event.event_date.split('T')[0].split('-').map(Number);
    const today = new Date();
    return year === today.getFullYear() && month === today.getMonth() + 1;
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda de Eventos</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe todos os eventos agendados
          </p>
        </div>
        <button
          onClick={() => setShowEventForm(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors"
        >
          Novo Evento
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hoje</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  eventos · {todayEvents.reduce((acc, event) => acc + event.total_people, 0)} pessoas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{thisWeekEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  eventos · {thisWeekEvents.reduce((acc, event) => acc + event.total_people, 0)} pessoas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{thisMonthEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  eventos · {thisMonthEvents.reduce((acc, event) => acc + event.total_people, 0)} pessoas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Próximos Eventos — cards operacionais */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Próximos eventos
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum evento próximo agendado</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <EventOperationalCard
                    key={event.id}
                    event={{ ...event, client_name: event.clients?.name }}
                    onEdit={() => handleEditEvent(event)}
                    onRefresh={refetchEvents}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA OPERACIONAL */}
        <TabsContent value="operacional" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Todos os eventos com visão operacional completa</p>
          </div>
          {events.filter(e => e.status !== 'Cancelado').length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Nenhum evento cadastrado</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => e.status !== 'Cancelado')
                .map(event => (
                  <EventOperationalCard
                    key={event.id}
                    event={{ ...event, client_name: event.clients?.name }}
                    onEdit={() => handleEditEvent(event)}
                    onRefresh={refetchEvents}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <EventCalendar 
            events={events} 
            onEventSelect={handleEditEvent}
            onEventCreate={(date) => {
              setSelectedDateForNewEvent(date);
              setShowEventForm(true);
            }}
          />
        </TabsContent>

        <TabsContent value="events">
          <EventsList
            events={events}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
            onRefresh={refetchEvents}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <EventNotifications events={events} />
        </TabsContent>
      </Tabs>

      {/* Modal de Formulário */}
      {showEventForm && (
        <EventForm
          event={editingEvent}
          initialDate={selectedDateForNewEvent}
          onSuccess={handleEventSuccess}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
            setSelectedDateForNewEvent(undefined);
          }}
        />
      )}
    </div>
  );
}
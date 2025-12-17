import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, MapPin, CheckSquare, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EventsList } from '@/components/agenda/EventsList';
import { EventCalendar } from '@/components/agenda/EventCalendar';
import { EventForm } from '@/components/agenda/EventForm';
import { EventNotifications } from '@/components/agenda/EventNotifications';
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
  clients?: {
    name: string;
  };
}

export default function Agenda() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { userRole, isAdminOrManager, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!roleLoading && isAdminOrManager()) {
      loadEvents();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [userRole, roleLoading]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          clients:client_id (
            name
          )
        `)
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleEventSuccess = () => {
    setShowEventForm(false);
    setEditingEvent(null);
    setSelectedDateForNewEvent(undefined);
    loadEvents();
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
      
      loadEvents();
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

  if (loading) {
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hoje</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  eventos programados
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
                  eventos próximos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Pessoas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {thisWeekEvents.reduce((acc, event) => acc + event.total_people, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  pessoas esta semana
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

          {/* Próximos Eventos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Próximos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum evento próximo agendado
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{event.event_name}</h3>
                          {getStatusBadge(event.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {event.event_date.split('T')[0].split('-').reverse().join('/')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {event.total_people} pessoas
                          </span>
                          {event.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.venue}
                            </span>
                          )}
                        </div>
                        {event.clients && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Cliente: {event.clients.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          R$ {Number(event.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.total_weight}g total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
            onRefresh={loadEvents}
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
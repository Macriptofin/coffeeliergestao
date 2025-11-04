import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { addMonths, subMonths, format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventSession {
  id: string;
  event_id: string;
  session_date: string;
  session_time: string;
  session_type: string;
  quantity: number;
}

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  status: string;
  total_people: number;
  total_amount: number;
  clients?: {
    name: string;
  };
}

interface EventCalendarProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
  onEventCreate: (date?: Date) => void;
}

export function EventCalendar({ events, onEventSelect, onEventCreate }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [allSessions, setAllSessions] = useState<EventSession[]>([]);

  // Carregar todas as sessões
  useEffect(() => {
    const loadSessions = async () => {
      const eventIds = events.map(e => e.id);
      if (eventIds.length === 0) {
        setAllSessions([]);
        return;
      }

      const { data } = await supabase
        .from('event_sessions')
        .select('*')
        .in('event_id', eventIds);

      if (data) {
        setAllSessions(data);
      }
    };

    loadSessions();
  }, [events]);

  const getStatusColor = (status: string) => {
    const colors = {
      'Agendado': 'bg-blue-500',
      'Em Preparação': 'bg-yellow-500',
      'Em Andamento': 'bg-green-500',
      'Concluído': 'bg-gray-500',
      'Cancelado': 'bg-red-500'
    } as const;
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.event_date + 'T00:00:00'), date)
    );
  };

  const getSessionsForDate = (date: Date) => {
    return allSessions.filter(session =>
      isSameDay(new Date(session.session_date + 'T00:00:00'), date)
    );
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  // Criar dados para o calendário com indicadores de eventos
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentDate}
            onMonthChange={setCurrentDate}
            locale={ptBR}
            className="w-full p-6"
            components={{
              DayContent: ({ date }) => {
                const dayEvents = getEventsForDate(date);
                const daySessions = getSessionsForDate(date);
                const hasActivity = dayEvents.length > 0 || daySessions.length > 0;
                
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{date.getDate()}</span>
                    {hasActivity && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1 max-w-full overflow-hidden">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(event.status)}`}
                            title={event.event_name}
                          />
                        ))}
                        {daySessions.length > 0 && (
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-orange-500"
                            title={`${daySessions.length} fornecimento(s)`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Eventos do Dia Selecionado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {selectedDate 
                ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'
              }
            </span>
            {selectedDate && (
              <Button
                size="sm"
                onClick={() => onEventCreate(selectedDate)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateEvents.length === 0 && selectedDateSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                {selectedDate 
                  ? 'Nenhum evento ou fornecimento agendado para esta data'
                  : 'Selecione uma data para ver os eventos'
                }
              </p>
              {selectedDate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEventCreate(selectedDate)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Evento
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Eventos principais */}
              {selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventSelect(event)}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">{event.event_name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {event.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {event.clients && (
                      <p>{event.clients.name}</p>
                    )}
                    <p>{event.total_people} pessoas</p>
                    <p className="font-medium">
                      R$ {Number(event.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Fornecimentos do dia */}
              {selectedDateSessions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Fornecimentos Agendados
                  </h4>
                  <div className="space-y-2">
                    {selectedDateSessions.map((session) => {
                      const event = events.find(e => e.id === session.event_id);
                      return (
                        <div
                          key={session.id}
                          onClick={() => event && onEventSelect(event)}
                          className="p-2 bg-orange-50 border border-orange-200 rounded cursor-pointer hover:bg-orange-100 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-medium text-orange-900">
                              {session.session_time} - {session.session_type}
                            </div>
                            <div className="text-orange-700">
                              {session.quantity} pessoas
                            </div>
                          </div>
                          {event && (
                            <div className="text-xs text-orange-600 mt-1">
                              {event.event_name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
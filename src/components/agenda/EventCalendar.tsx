import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { addMonths, subMonths, format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
      isSameDay(new Date(event.event_date), date)
    );
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Criar dados para o calendário com indicadores de eventos
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário de Eventos
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentDate}
            onMonthChange={setCurrentDate}
            locale={ptBR}
            className="rounded-md border"
            components={{
              DayContent: ({ date }) => {
                const dayEvents = getEventsForDate(date);
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{date.getDate()}</span>
                    {dayEvents.length > 0 && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1 max-w-full overflow-hidden">
                        {dayEvents.slice(0, 3).map((event, index) => (
                          <div
                            key={event.id}
                            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(event.status)}`}
                            title={event.event_name}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" title={`+${dayEvents.length - 3} eventos`} />
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
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                {selectedDate 
                  ? 'Nenhum evento agendado para esta data'
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
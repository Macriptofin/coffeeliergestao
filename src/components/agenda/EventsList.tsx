import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, MapPin, Edit, Trash2, Eye, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EventDetailsDialog } from './EventDetailsDialog';

interface EventSession {
  id: string;
  event_id: string;
  session_date: string;
  session_time: string;
  session_type: string;
  quantity: number;
  notes?: string;
}

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
  sessions?: EventSession[];
}

interface EventsListProps {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => void;
  onRefresh: () => void;
}

export function EventsList({ events, onEdit, onDelete, onRefresh }: EventsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [eventSessions, setEventSessions] = useState<Record<string, EventSession[]>>({});

  // Carregar sessões para todos os eventos
  useEffect(() => {
    const loadSessions = async () => {
      const eventIds = events.map(e => e.id);
      if (eventIds.length === 0) return;

      const { data } = await supabase
        .from('event_sessions')
        .select('*')
        .in('event_id', eventIds)
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true });

      if (data) {
        const sessionsByEvent: Record<string, EventSession[]> = {};
        data.forEach((session) => {
          if (!sessionsByEvent[session.event_id]) {
            sessionsByEvent[session.event_id] = [];
          }
          sessionsByEvent[session.event_id].push(session);
        });
        setEventSessions(sessionsByEvent);
      }
    };

    loadSessions();
  }, [events]);

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

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

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.venue?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || statusFilter === '' || event.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lista de Eventos</span>
          <Button onClick={onRefresh} variant="outline" size="sm">
            Atualizar
          </Button>
        </CardTitle>
        
        {/* Filtros */}
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por evento, cliente ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
              <SelectItem value="Em Preparação">Em Preparação</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {events.length === 0 ? 'Nenhum evento cadastrado' : 'Nenhum evento encontrado com os filtros aplicados'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento / Cliente</TableHead>
                <TableHead>Data e Hora</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Pessoas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => {
                const sessions = eventSessions[event.id] || [];
                const isExpanded = expandedEvents.has(event.id);
                const totalSessionQuantity = sessions.reduce((sum, s) => sum + s.quantity, 0);

                return (
                  <>
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sessions.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleEventExpansion(event.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <div>
                            <div className="font-medium">{event.event_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {event.clients?.name || 'Cliente não informado'}
                            </div>
                            {sessions.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {sessions.length} {sessions.length === 1 ? 'fornecimento' : 'fornecimentos'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{event.event_date.split('T')[0].split('-').reverse().join('/')}</span>
                        </div>
                        {event.setup_time && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {event.setup_time} ({event.event_duration}h)
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.venue ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{event.venue}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não definido</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{event.total_people}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.total_weight}g total
                        </div>
                        {sessions.length > 0 && totalSessionQuantity > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {totalSessionQuantity} pessoas (agendas)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(event.status)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          R$ {Number(event.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowDetails(true);
                            }}
                            title="Ver detalhes e anexos"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(event)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(event.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Sessões expandidas */}
                    {isExpanded && sessions.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="py-2 px-4">
                            <h4 className="font-semibold text-sm mb-3">Agendas de Fornecimento</h4>
                            <div className="space-y-2">
                              {sessions.map((session, idx) => (
                                <div
                                  key={session.id}
                                  className="flex items-center gap-4 text-sm p-2 bg-background rounded border"
                                >
                                  <div className="flex items-center gap-2 min-w-[100px]">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                  </div>
                                  <div className="flex items-center gap-2 min-w-[80px]">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span>{session.session_time}</span>
                                  </div>
                                  <div className="min-w-[80px]">
                                    <span className="text-muted-foreground">Período:</span>{' '}
                                    <span className="font-medium">{session.session_type}</span>
                                  </div>
                                  <div className="min-w-[100px]">
                                    <span className="text-muted-foreground">Quantidade:</span>{' '}
                                    <span className="font-medium">{session.quantity} pessoas</span>
                                  </div>
                                  {session.notes && (
                                    <div className="flex-1 text-muted-foreground italic text-xs">
                                      {session.notes}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <EventDetailsDialog
        event={selectedEvent}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </Card>
  );
}
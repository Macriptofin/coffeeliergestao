import { useState } from 'react';
import { Calendar, Clock, Users, MapPin, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EventDetailsDialog } from './EventDetailsDialog';

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
              {filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{event.event_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.clients?.name || 'Cliente não informado'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(event.event_date).toLocaleDateString('pt-BR')}</span>
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
              ))}
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
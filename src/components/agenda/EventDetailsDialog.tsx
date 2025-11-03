import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Users, MapPin, User, Phone } from 'lucide-react';
import { EventAttachmentsList } from './EventAttachmentsList';

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
  clients?: {
    name: string;
  };
}

interface EventDetailsDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailsDialog({ event, open, onOpenChange }: EventDetailsDialogProps) {
  if (!event) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{event.event_name}</span>
            <Badge className={getStatusColor(event.status)}>
              {event.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-3">Informações do Evento</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">
                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {event.setup_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="font-medium">{event.setup_time} ({event.event_duration}h)</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Pessoas:</span>
                  <span className="font-medium">{event.total_people}</span>
                </div>
                {event.venue && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Local:</span>
                      <p className="font-medium">{event.venue}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Cliente e Contato</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{event.clients?.name || 'Não informado'}</span>
                </div>
                {event.contact_person && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Contato:</span>
                    <span className="font-medium">{event.contact_person}</span>
                  </div>
                )}
                {event.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-medium">{event.contact_phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <h3 className="font-semibold mb-3">Valores</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Peso Total:</span>
                <p className="font-medium text-lg">{event.total_weight}g</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Total:</span>
                <p className="font-medium text-lg">
                  R$ {Number(event.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Observações */}
          {(event.setup_notes || event.special_requirements) && (
            <>
              <Separator />
              <div className="space-y-4">
                {event.setup_notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Observações de Setup</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {event.setup_notes}
                    </p>
                  </div>
                )}
                {event.special_requirements && (
                  <div>
                    <h3 className="font-semibold mb-2">Requisitos Especiais</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {event.special_requirements}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Anexos */}
          <Separator />
          <EventAttachmentsList eventId={event.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

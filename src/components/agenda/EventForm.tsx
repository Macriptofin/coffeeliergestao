import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
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
}

interface EventFormData {
  client_id: string;
  event_name: string;
  event_date: Date;
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
}

interface EventFormProps {
  event?: Event | null;
  initialDate?: Date;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EventForm({ event, initialDate, onSuccess, onCancel }: EventFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EventFormData>({
    defaultValues: {
      client_id: event?.client_id || '',
      event_name: event?.event_name || '',
      event_date: event ? new Date(event.event_date) : (initialDate || new Date()),
      setup_time: event?.setup_time || '',
      event_duration: event?.event_duration || 4,
      status: event?.status || 'Agendado',
      venue: event?.venue || '',
      contact_person: event?.contact_person || '',
      contact_phone: event?.contact_phone || '',
      total_people: event?.total_people || 0,
      total_weight: event?.total_weight || 0,
      total_amount: event?.total_amount || 0,
      setup_notes: event?.setup_notes || '',
      special_requirements: event?.special_requirements || ''
    }
  });

  const selectedDate = watch('event_date');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoadingClients(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      setLoading(true);

      const eventData = {
        client_id: data.client_id,
        event_name: data.event_name,
        event_date: data.event_date.toISOString().split('T')[0],
        setup_time: data.setup_time || null,
        event_duration: data.event_duration,
        status: data.status,
        venue: data.venue || null,
        contact_person: data.contact_person || null,
        contact_phone: data.contact_phone || null,
        total_people: data.total_people,
        total_weight: data.total_weight,
        total_amount: data.total_amount,
        setup_notes: data.setup_notes || null,
        special_requirements: data.special_requirements || null
      };

      if (event?.id) {
        // Atualizar evento existente
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id);

        if (error) throw error;
      } else {
        // Criar novo evento
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;

        // Criar notificações automáticas para o novo evento
        if (newEvent) {
          await supabase.rpc('create_event_notifications', { p_event_id: newEvent.id });
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar evento:', error);
      toast.error('Erro ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {event ? 'Editar Evento' : 'Novo Evento'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cliente */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente *</Label>
                <Select
                  value={watch('client_id')}
                  onValueChange={(value) => setValue('client_id', value)}
                  disabled={loadingClients}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.client_id && (
                  <p className="text-sm text-destructive">Cliente é obrigatório</p>
                )}
              </div>

              {/* Nome do Evento */}
              <div className="space-y-2">
                <Label htmlFor="event_name">Nome do Evento *</Label>
                <Input
                  {...register('event_name', { required: 'Nome do evento é obrigatório' })}
                  placeholder="Digite o nome do evento"
                />
                {errors.event_name && (
                  <p className="text-sm text-destructive">{errors.event_name.message}</p>
                )}
              </div>

              {/* Data do Evento */}
              <div className="space-y-2">
                <Label>Data do Evento *</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setValue('event_date', date);
                          setCalendarOpen(false);
                        }
                      }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Horário de Setup */}
              <div className="space-y-2">
                <Label htmlFor="setup_time">Horário de Setup</Label>
                <Input
                  {...register('setup_time')}
                  type="time"
                  placeholder="08:00"
                />
              </div>

              {/* Duração do Evento */}
              <div className="space-y-2">
                <Label htmlFor="event_duration">Duração (horas) *</Label>
                <Input
                  {...register('event_duration', { 
                    required: 'Duração é obrigatória',
                    min: { value: 1, message: 'Duração mínima de 1 hora' }
                  })}
                  type="number"
                  min="1"
                  placeholder="4"
                />
                {errors.event_duration && (
                  <p className="text-sm text-destructive">{errors.event_duration.message}</p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Em Preparação">Em Preparação</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Local do Evento */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="venue">Local do Evento</Label>
                <Input
                  {...register('venue')}
                  placeholder="Endereço ou nome do local"
                />
              </div>

              {/* Pessoa de Contato */}
              <div className="space-y-2">
                <Label htmlFor="contact_person">Pessoa de Contato</Label>
                <Input
                  {...register('contact_person')}
                  placeholder="Nome do responsável"
                />
              </div>

              {/* Telefone de Contato */}
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefone de Contato</Label>
                <Input
                  {...register('contact_phone')}
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* Número de Pessoas */}
              <div className="space-y-2">
                <Label htmlFor="total_people">Número de Pessoas *</Label>
                <Input
                  {...register('total_people', { 
                    required: 'Número de pessoas é obrigatório',
                    min: { value: 1, message: 'Mínimo de 1 pessoa' }
                  })}
                  type="number"
                  min="1"
                  placeholder="50"
                />
                {errors.total_people && (
                  <p className="text-sm text-destructive">{errors.total_people.message}</p>
                )}
              </div>

              {/* Peso Total */}
              <div className="space-y-2">
                <Label htmlFor="total_weight">Peso Total (g) *</Label>
                <Input
                  {...register('total_weight', { 
                    required: 'Peso total é obrigatório',
                    min: { value: 0, message: 'Peso não pode ser negativo' }
                  })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="10000"
                />
                {errors.total_weight && (
                  <p className="text-sm text-destructive">{errors.total_weight.message}</p>
                )}
              </div>

              {/* Valor Total */}
              <div className="space-y-2">
                <Label htmlFor="total_amount">Valor Total (R$) *</Label>
                <Input
                  {...register('total_amount', { 
                    required: 'Valor total é obrigatório',
                    min: { value: 0, message: 'Valor não pode ser negativo' }
                  })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="2500.00"
                />
                {errors.total_amount && (
                  <p className="text-sm text-destructive">{errors.total_amount.message}</p>
                )}
              </div>

              {/* Observações de Setup */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="setup_notes">Observações de Setup</Label>
                <Textarea
                  {...register('setup_notes')}
                  placeholder="Instruções especiais para montagem..."
                  rows={3}
                />
              </div>

              {/* Requisitos Especiais */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="special_requirements">Requisitos Especiais</Label>
                <Textarea
                  {...register('special_requirements')}
                  placeholder="Necessidades especiais do evento..."
                  rows={3}
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : (event ? 'Atualizar Evento' : 'Criar Evento')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
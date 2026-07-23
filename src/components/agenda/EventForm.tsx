import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X, Plus, Trash2 } from 'lucide-react';
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

interface EventSession {
  id?: string;
  session_date: Date;
  session_time?: string;
  session_type?: string;
  quantity: number;
  notes?: string;
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
  sessions?: EventSession[];
}

interface EventFormProps {
  event?: Event | null;
  initialDate?: Date;
  onSuccess: () => void;
  onCancel: () => void;
}

// Helper para converter data do banco (YYYY-MM-DD) para Date local
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const EMPTY_CLIENTS: Client[] = [];

async function fetchActiveClientsForEventForm(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('status', 'Ativo')
    .order('name');

  if (error) throw error;
  return data || [];
}

async function fetchEventSessions(eventId: string) {
  const { data, error } = await supabase
    .from('event_sessions')
    .select('*')
    .eq('event_id', eventId)
    .order('session_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function EventForm({ event, initialDate, onSuccess, onCancel }: EventFormProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [sessionCalendarOpen, setSessionCalendarOpen] = useState<number | null>(null);
  const [originalEventDate, setOriginalEventDate] = useState<Date | null>(null);

  const { data: clients = EMPTY_CLIENTS, isPending: loadingClients, isError: clientsError } = useQuery({
    queryKey: ['active-clients-list'],
    queryFn: fetchActiveClientsForEventForm,
  });

  useEffect(() => {
    if (clientsError) toast.error('Erro ao carregar clientes');
  }, [clientsError]);

  const { data: existingSessions } = useQuery({
    queryKey: ['event-sessions-form', event?.id],
    queryFn: () => fetchEventSessions(event!.id),
    enabled: !!event?.id,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EventFormData>({
    defaultValues: {
      client_id: event?.client_id || '',
      event_name: event?.event_name || '',
      event_date: event ? parseLocalDate(event.event_date) : (initialDate || new Date()),
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

  // Sincroniza as sessões locais (editáveis) assim que a busca das sessões existentes resolve.
  useEffect(() => {
    if (!existingSessions || !event) return;
    setSessions(existingSessions.map(s => ({
      id: s.id,
      session_date: parseLocalDate(s.session_date),
      session_time: s.session_time || '',
      session_type: s.session_type || '',
      quantity: s.quantity,
      notes: s.notes || ''
    })));
    // Armazenar a data original do evento para detectar mudanças
    setOriginalEventDate(parseLocalDate(event.event_date));
  }, [existingSessions, event]);

  // Ajustar datas das sessions automaticamente quando a data do evento muda
  useEffect(() => {
    if (!originalEventDate || !selectedDate || sessions.length === 0) return;
    
    // Calcular diferença em dias entre data original e nova data
    const timeDiff = selectedDate.getTime() - originalEventDate.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    // Se houve mudança na data, ajustar todas as sessions
    if (daysDiff !== 0) {
      setSessions(prevSessions => prevSessions.map(session => {
        const newDate = new Date(session.session_date);
        newDate.setDate(newDate.getDate() + daysDiff);
        return {
          ...session,
          session_date: newDate
        };
      }));
      
      // Atualizar a data original para a nova data
      setOriginalEventDate(selectedDate);
      
      toast.info(`Datas dos fornecimentos ajustadas automaticamente (${daysDiff > 0 ? '+' : ''}${daysDiff} dias)`);
    }
  }, [selectedDate]);

  // Atualiza o formulário quando o evento ou data inicial mudar
  useEffect(() => {
    reset({
      client_id: event?.client_id || '',
      event_name: event?.event_name || '',
      event_date: event ? parseLocalDate(event.event_date) : (initialDate || new Date()),
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
    });
  }, [event, initialDate, reset]);

  const onSubmit = async (data: EventFormData) => {
    try {
      setLoading(true);

      const eventData = {
        client_id: data.client_id,
        event_name: data.event_name,
        event_date: format(data.event_date, 'yyyy-MM-dd'),
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

      let eventId: string;

      if (event?.id) {
        // Atualizar evento existente
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id);

        if (error) throw error;
        eventId = event.id;
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
          eventId = newEvent.id;
        } else {
          throw new Error('Erro ao criar evento');
        }
      }

      // Salvar sessões
      if (sessions.length > 0) {
        // Remover sessões antigas se estiver editando
        if (event?.id) {
          await supabase
            .from('event_sessions')
            .delete()
            .eq('event_id', eventId);
        }

        // Inserir novas sessões
        const sessionsData = sessions.map(s => ({
          event_id: eventId,
          session_date: format(s.session_date, 'yyyy-MM-dd'),
          session_time: s.session_time || null,
          session_type: s.session_type || null,
          quantity: s.quantity,
          notes: s.notes || null
        }));

        const { error: sessionsError } = await supabase
          .from('event_sessions')
          .insert(sessionsData);

        if (sessionsError) throw sessionsError;
      }

      queryClient.invalidateQueries({ queryKey: ['event-sessions-form', eventId] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'event-sessions' });

      toast.success(event?.id ? 'Evento atualizado com sucesso!' : 'Evento criado com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar evento:', error);
      toast.error('Erro ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  const addSession = () => {
    setSessions([...sessions, {
      session_date: new Date(),
      session_time: '',
      session_type: 'Manhã',
      quantity: 0,
      notes: ''
    }]);
  };

  const removeSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const updateSession = (index: number, field: keyof EventSession, value: any) => {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
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

            {/* Sessões/Agendas Múltiplas */}
            <div className="space-y-4 border-t pt-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Agendas de Fornecimento</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure diferentes horários e quantidades para o evento
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSession}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Agenda
                </Button>
              </div>

              {sessions.length > 0 && (
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                          {/* Data da Sessão */}
                          <div className="space-y-2">
                            <Label>Data *</Label>
                            <Popover 
                              open={sessionCalendarOpen === index} 
                              onOpenChange={(open) => setSessionCalendarOpen(open ? index : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                  size="sm"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(session.session_date, 'dd/MM', { locale: ptBR })}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={session.session_date}
                                  onSelect={(date) => {
                                    if (date) {
                                      updateSession(index, 'session_date', date);
                                      setSessionCalendarOpen(null);
                                    }
                                  }}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Horário */}
                          <div className="space-y-2">
                            <Label>Horário</Label>
                            <Input
                              type="time"
                              value={session.session_time}
                              onChange={(e) => updateSession(index, 'session_time', e.target.value)}
                              size={1}
                            />
                          </div>

                          {/* Tipo */}
                          <div className="space-y-2">
                            <Label>Período</Label>
                            <Select
                              value={session.session_type}
                              onValueChange={(value) => updateSession(index, 'session_type', value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Manhã">Manhã</SelectItem>
                                <SelectItem value="Tarde">Tarde</SelectItem>
                                <SelectItem value="Noite">Noite</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quantidade */}
                          <div className="space-y-2">
                            <Label>Quantidade *</Label>
                            <Input
                              type="number"
                              min="0"
                              value={session.quantity}
                              onChange={(e) => updateSession(index, 'quantity', parseInt(e.target.value) || 0)}
                              size={1}
                            />
                          </div>

                          {/* Observações */}
                          <div className="space-y-2 md:col-span-1">
                            <Label>Obs.</Label>
                            <Input
                              value={session.notes}
                              onChange={(e) => updateSession(index, 'notes', e.target.value)}
                              placeholder="Observações"
                              size={1}
                            />
                          </div>
                        </div>

                        {/* Botão Remover */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSession(index)}
                          className="mt-7"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}

                  {/* Total Geral */}
                  <div className="flex justify-end">
                    <Card className="p-4 bg-muted/50">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total de Pessoas</p>
                        <p className="text-2xl font-bold">
                          {sessions.reduce((sum, s) => sum + (s.quantity || 0), 0)}
                        </p>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>Nenhuma agenda configurada</p>
                  <p className="text-sm">Clique em "Adicionar Agenda" para configurar os horários de fornecimento</p>
                </div>
              )}
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
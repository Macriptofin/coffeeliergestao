import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Package, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EventTable {
  id: string;
  event_code: string;
  client_name: string;
  attendees: number;
  date_start: string;
  status: string;
}

interface EventProductionIntegrationProps {
  onOrderGenerated?: (orderId: string) => void;
}

const EMPTY_EVENTS: EventTable[] = [];

async function fetchPendingEvents(): Promise<EventTable[]> {
  const { data, error } = await supabase
    .from('event_tables')
    .select('*')
    .in('status', ['approved', 'planned'])
    .order('date_start');

  if (error) throw error;
  return data || [];
}

export const EventProductionIntegration = ({ onOrderGenerated }: EventProductionIntegrationProps) => {
  const queryClient = useQueryClient();
  const [generatingOrder, setGeneratingOrder] = useState<string | null>(null);

  const { data: events = EMPTY_EVENTS, isPending: loading } = useQuery({
    queryKey: ['event-tables-pending'],
    queryFn: fetchPendingEvents,
  });

  const reloadEvents = () => queryClient.invalidateQueries({ queryKey: ['event-tables-pending'] });

  const generateProductionOrder = async (eventId: string) => {
    setGeneratingOrder(eventId);
    try {
      const { data, error } = await supabase.rpc('generate_event_production', {
        p_event_table_id: eventId
      });

      if (error) throw error;

      toast.success('Ordem de produção gerada com sucesso!');
      onOrderGenerated?.(data);

      reloadEvents();
    } catch (error) {
      console.error('Erro ao gerar ordem:', error);
      toast.error('Erro ao gerar ordem de produção: ' + (error as Error).message);
    } finally {
      setGeneratingOrder(null);
    }
  };

  const executeEventProduction = async (eventId: string) => {
    setGeneratingOrder(eventId);
    try {
      const { error } = await supabase.rpc('execute_event_production', {
        p_event_table_id: eventId
      });

      if (error) throw error;

      toast.success('Produção do evento executada com sucesso!');

      reloadEvents();
    } catch (error) {
      console.error('Erro ao executar produção:', error);
      toast.error('Erro ao executar produção: ' + (error as Error).message);
    } finally {
      setGeneratingOrder(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprovado';
      case 'planned':
        return 'Planejado';
      default:
        return status;
    }
  };

  if (events.length === 0 && !loading) {
    return (
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          Nenhum evento pendente encontrado. Vá para Mesas/Eventos para criar novos eventos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Eventos Pendentes</h3>
          <p className="text-sm text-muted-foreground">
            Eventos aguardando geração de ordem de produção
          </p>
        </div>
        <Button onClick={reloadEvents} variant="outline" disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

      <div className="grid gap-4">
        {events.map((event) => (
          <Card key={event.id} className="shadow-soft">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{event.event_code}</CardTitle>
                  <CardDescription>{event.client_name}</CardDescription>
                </div>
                <Badge className={getStatusColor(event.status)}>
                  {getStatusLabel(event.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{event.attendees} pessoas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(event.date_start).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => generateProductionOrder(event.id)}
                  disabled={generatingOrder === event.id}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-1" />
                  {generatingOrder === event.id ? 'Gerando...' : 'Gerar Ordem'}
                </Button>
                
                <Button
                  onClick={() => executeEventProduction(event.id)}
                  disabled={generatingOrder === event.id}
                  size="sm"
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  {generatingOrder === event.id ? 'Executando...' : 'Executar Produção'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
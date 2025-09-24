import { useState, useEffect } from 'react';
import { Bell, Calendar, Clock, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  clients?: {
    name: string;
  };
}

interface EventNotification {
  id: string;
  event_id: string;
  notification_type: string;
  trigger_date: string;
  message: string;
  notification_method: string;
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
  events?: {
    event_name: string;
    event_date: string;
    clients?: {
      name: string;
    };
  };
}

interface EventNotificationsProps {
  events: Event[];
}

export function EventNotifications({ events }: EventNotificationsProps) {
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('event_notifications')
        .select(`
          *,
          events:event_id (
            event_name,
            event_date,
            clients:client_id (
              name
            )
          )
        `)
        .order('trigger_date', { ascending: true });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar notificações:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const markAsSent = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('event_notifications')
        .update({
          is_sent: true,
          sent_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) throw error;
      
      loadNotifications();
      toast.success('Notificação marcada como enviada');
    } catch (error: any) {
      console.error('Erro ao marcar notificação:', error);
      toast.error('Erro ao marcar notificação');
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels = {
      'confirmacao': 'Confirmação',
      'lista_compras': 'Lista de Compras',
      'checklist': 'Checklist',
      'confirmacao_entrega': 'Confirmação de Entrega',
      'lembrete_final': 'Lembrete Final',
      'setup': 'Setup'
    } as const;
    return labels[type as keyof typeof labels] || type;
  };

  const getNotificationIcon = (type: string) => {
    const icons = {
      'confirmacao': Bell,
      'lista_compras': CheckCircle,
      'checklist': CheckCircle,
      'confirmacao_entrega': Send,
      'lembrete_final': AlertCircle,
      'setup': Clock
    } as const;
    const Icon = icons[type as keyof typeof icons] || Bell;
    return <Icon className="h-4 w-4" />;
  };

  const getNotificationVariant = (type: string) => {
    const variants = {
      'confirmacao': 'default',
      'lista_compras': 'secondary',
      'checklist': 'outline',
      'confirmacao_entrega': 'default',
      'lembrete_final': 'destructive',
      'setup': 'secondary'
    } as const;
    return variants[type as keyof typeof variants] || 'default';
  };

  const pendingNotifications = notifications.filter(n => !n.is_sent);
  const sentNotifications = notifications.filter(n => n.is_sent);
  const todayNotifications = notifications.filter(n => 
    new Date(n.trigger_date).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingNotifications.length}</div>
            <p className="text-xs text-muted-foreground">
              notificações aguardando
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayNotifications.length}</div>
            <p className="text-xs text-muted-foreground">
              notificações de hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentNotifications.length}</div>
            <p className="text-xs text-muted-foreground">
              notificações enviadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes ({pendingNotifications.length})
              </TabsTrigger>
              <TabsTrigger value="today">
                Hoje ({todayNotifications.length})
              </TabsTrigger>
              <TabsTrigger value="sent">
                Enviadas ({sentNotifications.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma notificação pendente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data de Envio</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingNotifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {notification.events?.event_name || 'Evento não encontrado'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {notification.events?.clients?.name || 'Cliente não informado'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getNotificationVariant(notification.notification_type)}>
                            <span className="flex items-center gap-1">
                              {getNotificationIcon(notification.notification_type)}
                              {getNotificationTypeLabel(notification.notification_type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(notification.trigger_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {notification.notification_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate">{notification.message}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsSent(notification.id)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Marcar como Enviada
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="today">
              {todayNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma notificação para hoje</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayNotifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {notification.events?.event_name || 'Evento não encontrado'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {notification.events?.clients?.name || 'Cliente não informado'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getNotificationVariant(notification.notification_type)}>
                            <span className="flex items-center gap-1">
                              {getNotificationIcon(notification.notification_type)}
                              {getNotificationTypeLabel(notification.notification_type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {notification.is_sent ? (
                            <Badge variant="default">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Enviada
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-4 w-4 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm">{notification.message}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="sent">
              {sentNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma notificação enviada ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data de Envio</TableHead>
                      <TableHead>Enviada em</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentNotifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {notification.events?.event_name || 'Evento não encontrado'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {notification.events?.clients?.name || 'Cliente não informado'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getNotificationVariant(notification.notification_type)}>
                            <span className="flex items-center gap-1">
                              {getNotificationIcon(notification.notification_type)}
                              {getNotificationTypeLabel(notification.notification_type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(notification.trigger_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {notification.sent_at && 
                            format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          }
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate">{notification.message}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
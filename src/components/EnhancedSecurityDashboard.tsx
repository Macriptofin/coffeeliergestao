import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Activity, 
  Clock,
  Eye,
  UserX,
  Database,
  LogOut
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const EnhancedSecurityDashboard = () => {
  const { alerts, loading: alertsLoading, acknowledgeAlert } = useSecurityAlerts();
  const { events, loading: eventsLoading } = useSecurityMonitoring();
  const { sessionState, extendSession, terminateSession, timeUntilExpiry } = useSessionSecurity();
  const { userRole, isAdmin, isAdminOrManager } = useUserRole();

  // Security status checks
  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  const highPriorityAlerts = activeAlerts.filter(alert => 
    alert.severity === 'critical' || alert.severity === 'high'
  );

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      toast.success('Alerta reconhecido');
    } catch (error) {
      toast.error('Erro ao reconhecer alerta');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return AlertTriangle;
      case 'high': return AlertTriangle;
      case 'medium': return Shield;
      case 'low': return Activity;
      default: return Shield;
    }
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (!isAdminOrManager) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Apenas administradores e gerentes podem visualizar o dashboard de segurança.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Segurança Avançado</h1>
          <p className="text-muted-foreground">
            Monitoramento de segurança, alertas e atividades suspeitas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={sessionState.isActive ? 'default' : 'destructive'}>
            {sessionState.isActive ? 'Sessão Ativa' : 'Sessão Expirada'}
          </Badge>
          {sessionState.isActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Expira em: {formatTimeRemaining(timeUntilExpiry)}
            </div>
          )}
        </div>
      </div>

      {/* Session Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Segurança da Sessão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-medium">Status da Sessão</p>
              <p className="text-sm text-muted-foreground">
                Última atividade: {formatDistanceToNow(sessionState.lastActivity, { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={extendSession} variant="outline" size="sm">
                Estender Sessão
              </Button>
              <Button onClick={terminateSession} variant="destructive" size="sm">
                <LogOut className="h-4 w-4 mr-1" />
                Terminar Sessão
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Requerem atenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Ação imediata necessária
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highPriorityAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Monitoramento próximo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Total de alertas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Segurança Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum alerta de segurança encontrado
            </p>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {alerts.slice(0, 10).map((alert) => {
                  const SeverityIcon = getSeverityIcon(alert.severity);
                  return (
                    <div key={alert.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <SeverityIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{alert.title}</h4>
                            <Badge variant={getSeverityColor(alert.severity) as any}>
                              {alert.severity}
                            </Badge>
                            {alert.acknowledged && (
                              <Badge variant="outline">Reconhecido</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(alert.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                            {alert.ip_address && <span>IP: {alert.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          variant="outline"
                          size="sm"
                        >
                          Reconhecer
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Security Events Log */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Log de Eventos de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : events.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum evento de segurança registrado
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {events.slice(0, 20).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.action}</Badge>
                          <span className="text-sm font-medium">{event.resourceType}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-4">
                          <span>
                            {formatDistanceToNow(new Date(event.timestamp), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                          {event.ipAddress && <span>IP: {event.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedSecurityDashboard;
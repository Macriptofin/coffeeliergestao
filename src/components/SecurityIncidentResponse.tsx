import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Shield, Lock, Eye, UserX, Database, Activity } from 'lucide-react';
import { useSecurityDashboard } from '@/hooks/useSecurityDashboard';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { useToast } from '@/hooks/use-toast';

const SecurityIncidentResponse = () => {
  const [activeIncident, setActiveIncident] = useState<string | null>(null);
  const { metrics, recentEvents, generateSecurityReport } = useSecurityDashboard();
  const { alerts, acknowledgeAlert } = useSecurityAlerts();
  const { toast } = useToast();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getIncidentTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_failed_login': return <UserX className="h-4 w-4" />;
      case 'suspicious_data_access': return <Eye className="h-4 w-4" />;
      case 'unauthorized_access': return <Lock className="h-4 w-4" />;
      case 'data_breach': return <Database className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleIncidentResponse = async (alertId: string, action: string) => {
    try {
      switch (action) {
        case 'acknowledge':
          await acknowledgeAlert(alertId);
          toast({
            title: "Incidente Reconhecido",
            description: "O incidente foi marcado como reconhecido.",
          });
          break;
        case 'investigate':
          setActiveIncident(alertId);
          toast({
            title: "Investigação Iniciada",
            description: "Coletando informações adicionais sobre o incidente.",
          });
          break;
        case 'escalate':
          toast({
            title: "Incidente Escalado",
            description: "O incidente foi escalado para análise de nível superior.",
            variant: "destructive",
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao processar resposta ao incidente.",
        variant: "destructive",
      });
    }
  };

  const generateIncidentReport = async () => {
    try {
      const report = await generateSecurityReport();
      if (report) {
        // In a real app, this could download a PDF or save to a file
        toast({
          title: "Relatório Gerado",
          description: "Relatório de segurança foi gerado com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório de incidente.",
        variant: "destructive",
      });
    }
  };

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged);
  const highAlerts = alerts.filter(alert => alert.severity === 'high' && !alert.acknowledged);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Central de Resposta a Incidentes</h1>
          <p className="text-muted-foreground">
            Monitore e responda a incidentes de segurança em tempo real
          </p>
        </div>
        <Button onClick={generateIncidentReport} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalAlerts.length} incidente(s) crítico(s)</strong> requer(em) atendimento imediato.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.unacknowledgedAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.criticalAlerts} críticos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tentativas de Auth</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.recentAuthAttempts}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.failedAuthAttempts} falharam (24h)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acesso a PII</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.recentPIIAccess}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24 horas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividade Suspeita</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.suspiciousActivity}</div>
            <p className="text-xs text-muted-foreground">
              Padrões detectados
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active-alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active-alerts">Alertas Ativos</TabsTrigger>
          <TabsTrigger value="recent-events">Eventos Recentes</TabsTrigger>
          <TabsTrigger value="investigation">Investigação</TabsTrigger>
        </TabsList>

        <TabsContent value="active-alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incidentes Requerendo Atenção</CardTitle>
              <CardDescription>
                Alertas de segurança que precisam de resposta imediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...criticalAlerts, ...highAlerts].map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getIncidentTypeIcon(alert.alert_type)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleIncidentResponse(alert.id, 'acknowledge')}
                      >
                        Reconhecer
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleIncidentResponse(alert.id, 'investigate')}
                      >
                        Investigar
                      </Button>
                      {alert.severity === 'critical' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleIncidentResponse(alert.id, 'escalate')}
                        >
                          Escalar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {criticalAlerts.length === 0 && highAlerts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum incidente ativo requer atenção no momento.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos de Segurança Recentes</CardTitle>
              <CardDescription>
                Atividades de segurança das últimas 24 horas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <span className="font-medium">{event.action}</span>
                      <span className="text-muted-foreground ml-2">
                        em {event.resource_type}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
                {recentEvents.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento de segurança recente.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas de Investigação</CardTitle>
              <CardDescription>
                Recursos para análise aprofundada de incidentes de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeIncident ? (
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Investigando incidente: {activeIncident}
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline">Análise de Logs</Button>
                    <Button variant="outline">Rastreamento de IP</Button>
                    <Button variant="outline">Auditoria de Usuário</Button>
                    <Button variant="outline">Cronologia de Eventos</Button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Selecione um incidente para iniciar a investigação.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityIncidentResponse;
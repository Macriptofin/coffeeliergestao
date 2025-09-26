import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { useSecurityNotifications } from '@/hooks/useSecurityNotifications';
import { useSecurityScanner } from '@/hooks/useSecurityScanner';
import { useUserRole } from '@/hooks/useUserRole';
import { AlertTriangle, Shield, Clock, CheckCircle, Scan, Bell, BellOff, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

const SecurityDashboard = () => {
  const { isAdminOrManager, isAdmin } = useUserRole();
  const { 
    alerts, 
    loading, 
    acknowledgeAlert, 
    getUnacknowledgedCount, 
    getCriticalAlertsCount,
    getHighPriorityAlertsCount 
  } = useSecurityAlerts();

  const {
    notifications,
    isEnabled: notificationsEnabled,
    enableNotifications,
    disableNotifications,
    getUnreadCount
  } = useSecurityNotifications();

  const {
    scanning,
    lastScanResults,
    autoScanEnabled,
    performComprehensiveScan,
    enableAutoScan,
    disableAutoScan
  } = useSecurityScanner();

  const [acknowledgingAlert, setAcknowledgingAlert] = useState<string | null>(null);

  if (!isAdminOrManager()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar o painel de segurança.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAcknowledgeAlert = async (alertId: string) => {
    setAcknowledgingAlert(alertId);
    try {
      const success = await acknowledgeAlert(alertId);
      if (success) {
        toast.success('Alerta reconhecido com sucesso');
      } else {
        toast.error('Erro ao reconhecer alerta');
      }
    } finally {
      setAcknowledgingAlert(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Painel de Segurança</h1>
        <p className="text-muted-foreground">
          Monitoramento de segurança e alertas do sistema
        </p>
      </div>

      {/* Security Controls */}
      {isAdmin() && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Controles de Segurança
            </CardTitle>
            <CardDescription>
              Configure monitoramento e notificações de segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Notificações de Segurança</h4>
                <p className="text-xs text-muted-foreground">
                  Receber alertas em tempo real para eventos críticos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableNotifications();
                    } else {
                      disableNotifications();
                    }
                  }}
                />
                {notificationsEnabled ? (
                  <Bell className="h-4 w-4 text-green-500" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Scan Automatizado</h4>
                <p className="text-xs text-muted-foreground">
                  Executar verificações de segurança a cada 6 horas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoScanEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableAutoScan();
                    } else {
                      disableAutoScan();
                    }
                  }}
                />
                {autoScanEnabled ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Pause className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Scan Manual</h4>
                <p className="text-xs text-muted-foreground">
                  Executar verificação completa de segurança agora
                </p>
              </div>
              <Button
                onClick={performComprehensiveScan}
                disabled={scanning}
                size="sm"
                variant="outline"
              >
                {scanning ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                    Escaneando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Scan className="h-4 w-4" />
                    Iniciar Scan
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getUnacknowledgedCount()}</div>
            <p className="text-xs text-muted-foreground">
              Não reconhecidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{getCriticalAlertsCount()}</div>
            <p className="text-xs text-muted-foreground">
              Requer ação imediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{getHighPriorityAlertsCount()}</div>
            <p className="text-xs text-muted-foreground">
              Investigar em breve
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimos alertas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Scan Results */}
      {isAdmin() && lastScanResults.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Resultado do Último Scan
            </CardTitle>
            <CardDescription>
              Verificações de segurança automatizadas mais recentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {lastScanResults.map((result) => (
                <div key={result.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium capitalize">
                      {result.scanType.replace('_', ' ')}
                    </h4>
                    <Badge 
                      variant={
                        result.riskLevel === 'critical' ? 'destructive' :
                        result.riskLevel === 'high' ? 'destructive' :
                        result.riskLevel === 'medium' ? 'secondary' : 'default'
                      }
                    >
                      {result.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {result.findings.length} problemas encontrados
                  </p>
                  {result.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(result.completedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {result.findings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.findings.slice(0, 2).map((finding, index) => (
                        <div key={index} className="text-xs p-2 bg-muted/50 rounded">
                          <span className="font-medium">{finding.type.replace('_', ' ')}: </span>
                          {finding.description}
                        </div>
                      ))}
                      {result.findings.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{result.findings.length - 2} outros problemas
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Notifications */}
      {notificationsEnabled && notifications.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações Recentes
              {getUnreadCount() > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {getUnreadCount()}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Últimas notificações de segurança em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {notification.severity === 'critical' && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    notification.severity === 'critical' ? 'destructive' :
                    notification.severity === 'high' ? 'destructive' :
                    notification.severity === 'medium' ? 'secondary' : 'default'
                  }>
                    {notification.severity.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset grid for alerts */}
      <div>
      </div>

      {/* Security Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Segurança Recentes</CardTitle>
          <CardDescription>
            Últimos 50 alertas ordenados por data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mr-2" />
                Nenhum alerta de segurança encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${
                      alert.acknowledged 
                        ? 'bg-muted/30 border-muted' 
                        : 'bg-background border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-sm font-semibold truncate">
                              {alert.title}
                            </h4>
                            <Badge variant={getSeverityColor(alert.severity) as any}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            {alert.acknowledged && (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Reconhecido
                              </Badge>
                            )}
                          </div>
                          
                          {alert.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {alert.description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>
                              {new Date(alert.created_at).toLocaleString('pt-BR')}
                            </span>
                            {alert.ip_address && (
                              <span>IP: {alert.ip_address}</span>
                            )}
                            <span className="capitalize">
                              {alert.alert_type.replace('_', ' ')}
                            </span>
                          </div>
                          
                          {alert.metadata && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(alert.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            disabled={acknowledgingAlert === alert.id}
                          >
                            {acknowledgingAlert === alert.id ? 'Processando...' : 'Reconhecer'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityDashboard;
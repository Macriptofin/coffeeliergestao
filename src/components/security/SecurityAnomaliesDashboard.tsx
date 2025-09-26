import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useEnhancedSecurityMonitoring } from '@/hooks/useEnhancedSecurityMonitoring';
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
  Search,
  Unlock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SecurityAnomaliesDashboard = () => {
  const { 
    piiAnomalies, 
    accountLockouts, 
    loading, 
    fetchPIIAnomalies, 
    fetchAccountLockouts,
    unlockAccount,
    investigatePIIAnomaly,
    getSecurityMetrics,
    isAuthorized
  } = useEnhancedSecurityMonitoring();
  
  const { isAdmin } = useUserRole();
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [investigationNotes, setInvestigationNotes] = useState('');
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (isAuthorized) {
      fetchPIIAnomalies();
      fetchAccountLockouts();
      getSecurityMetrics().then(setMetrics);
    }
  }, [isAuthorized]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getAnomalyTypeIcon = (type: string) => {
    switch (type) {
      case 'bulk_access': return Database;
      case 'off_hours': return Clock;
      case 'rapid_succession': return Activity;
      default: return Shield;
    }
  };

  const handleInvestigateAnomaly = async () => {
    if (selectedAnomaly && investigationNotes.trim()) {
      await investigatePIIAnomaly(selectedAnomaly.id, investigationNotes);
      setSelectedAnomaly(null);
      setInvestigationNotes('');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Apenas administradores podem visualizar anomalias de segurança.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Anomalias de Segurança</h1>
          <p className="text-muted-foreground">
            Monitoramento de padrões anômalos de acesso a dados
          </p>
        </div>
      </div>

      {/* Security Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Anomalias</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalAnomalies}</div>
              <p className="text-xs text-muted-foreground">Última semana</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alta Severidade</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{metrics.highSeverityAnomalies}</div>
              <p className="text-xs text-muted-foreground">Requerem atenção</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Não Investigadas</CardTitle>
              <Search className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{metrics.uninvestigatedAnomalies}</div>
              <p className="text-xs text-muted-foreground">Aguardam análise</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contas Bloqueadas</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeLockouts}</div>
              <p className="text-xs text-muted-foreground">Ativas no momento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bloqueios Semanais</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.weeklyLockouts}</div>
              <p className="text-xs text-muted-foreground">Última semana</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PII Access Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Anomalias de Acesso a Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : piiAnomalies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma anomalia detectada
            </p>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {piiAnomalies.map((anomaly) => {
                  const AnomalyIcon = getAnomalyTypeIcon(anomaly.anomaly_type);
                  return (
                    <div key={anomaly.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <AnomalyIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(anomaly.severity) as any}>
                              {anomaly.severity}
                            </Badge>
                            <Badge variant="outline">{anomaly.anomaly_type}</Badge>
                            <Badge variant="secondary">{anomaly.resource_type}</Badge>
                            {anomaly.is_investigated && (
                              <Badge variant="outline" className="text-green-600">
                                Investigado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">
                            <strong>Recursos acessados:</strong> {anomaly.resource_count}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(anomaly.detection_time), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                            {anomaly.ip_address && <span>IP: {anomaly.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!anomaly.is_investigated && isAdmin && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAnomaly(anomaly)}
                              >
                                Investigar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Investigar Anomalia</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Notas da Investigação</Label>
                                  <Textarea
                                    value={investigationNotes}
                                    onChange={(e) => setInvestigationNotes(e.target.value)}
                                    placeholder="Descreva os achados da investigação..."
                                    rows={4}
                                  />
                                </div>
                                <Button onClick={handleInvestigateAnomaly} className="w-full">
                                  Marcar como Investigado
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Account Lockouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Bloqueios de Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountLockouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum bloqueio de conta registrado
            </p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {accountLockouts.map((lockout) => {
                  const isActive = new Date(lockout.locked_until) > new Date() && !lockout.unlocked_at;
                  return (
                    <div key={lockout.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{lockout.user_email}</span>
                          <Badge variant={isActive ? 'destructive' : 'secondary'}>
                            {isActive ? 'Bloqueado' : 'Desbloqueado'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Tentativas:</strong> {lockout.failed_attempts}</p>
                          <p><strong>Motivo:</strong> {lockout.lock_reason}</p>
                          <p>
                            <strong>Bloqueado em:</strong> {' '}
                            {formatDistanceToNow(new Date(lockout.locked_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                          {isActive && (
                            <p>
                              <strong>Liberado em:</strong> {' '}
                              {new Date(lockout.locked_until).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                      {isActive && isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlockAccount(lockout.id)}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Desbloquear
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
    </div>
  );
};

export default SecurityAnomaliesDashboard;
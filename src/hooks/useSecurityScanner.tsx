import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { sanitizeForLogging, detectSecurityPatterns } from '@/lib/security-utils';
import { toast } from 'sonner';

interface SecurityScanResult {
  id: string;
  scanType: 'user_behavior' | 'data_access' | 'system_integrity' | 'authentication';
  status: 'running' | 'completed' | 'failed';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: SecurityFinding[];
  completedAt?: string;
  duration?: number;
}

interface SecurityFinding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
  affectedResource?: string;
  count?: number;
}

export function useSecurityScanner() {
  const { isAdmin } = useUserRole();
  const [scanning, setScanning] = useState(false);
  const [lastScanResults, setLastScanResults] = useState<SecurityScanResult[]>([]);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);

  useEffect(() => {
    if (isAdmin() && autoScanEnabled) {
      // Set up periodic scanning (every 6 hours)
      const interval = setInterval(() => {
        performAutomatedScan();
      }, 6 * 60 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isAdmin(), autoScanEnabled]);

  const performComprehensiveScan = async (): Promise<SecurityScanResult[]> => {
    if (!isAdmin()) {
      throw new Error('Unauthorized: Only admins can perform security scans');
    }

    setScanning(true);
    const scanResults: SecurityScanResult[] = [];

    try {
      // Run multiple security scans in parallel
      const [
        userBehaviorResult,
        dataAccessResult,
        authenticationResult,
        systemIntegrityResult
      ] = await Promise.allSettled([
        scanUserBehavior(),
        scanDataAccess(),
        scanAuthentication(),
        scanSystemIntegrity()
      ]);

      // Process results
      if (userBehaviorResult.status === 'fulfilled') {
        scanResults.push(userBehaviorResult.value);
      }
      if (dataAccessResult.status === 'fulfilled') {
        scanResults.push(dataAccessResult.value);
      }
      if (authenticationResult.status === 'fulfilled') {
        scanResults.push(authenticationResult.value);
      }
      if (systemIntegrityResult.status === 'fulfilled') {
        scanResults.push(systemIntegrityResult.value);
      }

      setLastScanResults(scanResults);
      
      // Create security alert if critical issues found
      const criticalFindings = scanResults.flatMap(result => 
        result.findings.filter(finding => finding.severity === 'critical')
      );

      if (criticalFindings.length > 0) {
        await createSecurityAlert(criticalFindings);
      }

      toast.success(`Scan de segurança concluído. ${scanResults.length} verificações realizadas.`);
      return scanResults;

    } catch (error) {
      console.error('Security scan failed:', sanitizeForLogging(error));
      toast.error('Falha no scan de segurança');
      throw error;
    } finally {
      setScanning(false);
    }
  };

  const scanUserBehavior = async (): Promise<SecurityScanResult> => {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    try {
      // Check for suspicious login patterns
      const { data: authAttempts, error } = await supabase
        .from('auth_attempts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Analyze authentication patterns
      if (authAttempts) {
        const failedAttempts = authAttempts.filter(attempt => !attempt.success);
        const uniqueIPs = new Set(failedAttempts.map(attempt => attempt.ip_address));
        
        if (failedAttempts.length > 50) {
          findings.push({
            type: 'excessive_failed_logins',
            severity: 'high',
            description: `${failedAttempts.length} tentativas de login falhadas nas últimas 24h`,
            recommendation: 'Verificar se há tentativas de ataque de força bruta',
            count: failedAttempts.length
          });
        }

        if (uniqueIPs.size > 20) {
          findings.push({
            type: 'multiple_ip_attacks',
            severity: 'medium',
            description: `Tentativas de login de ${uniqueIPs.size} IPs diferentes`,
            recommendation: 'Considerar implementar rate limiting por IP',
            count: uniqueIPs.size
          });
        }

        // Check for off-hours access
        const offHoursAttempts = authAttempts.filter(attempt => {
          const hour = new Date(attempt.created_at).getHours();
          return hour < 6 || hour > 22;
        });

        if (offHoursAttempts.length > 10) {
          findings.push({
            type: 'off_hours_access',
            severity: 'medium',
            description: `${offHoursAttempts.length} tentativas de acesso fora do horário comercial`,
            recommendation: 'Verificar se o acesso fora do horário é legítimo',
            count: offHoursAttempts.length
          });
        }
      }

      const riskLevel = findings.some(f => f.severity === 'critical') ? 'critical' :
                      findings.some(f => f.severity === 'high') ? 'high' :
                      findings.some(f => f.severity === 'medium') ? 'medium' : 'low';

      return {
        id: crypto.randomUUID(),
        scanType: 'user_behavior',
        status: 'completed',
        riskLevel,
        findings,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        id: crypto.randomUUID(),
        scanType: 'user_behavior',
        status: 'failed',
        riskLevel: 'low',
        findings: [{
          type: 'scan_error',
          severity: 'medium',
          description: 'Falha ao analisar comportamento do usuário',
          recommendation: 'Verificar logs e permissões do sistema'
        }],
        duration: Date.now() - startTime
      };
    }
  };

  const scanDataAccess = async (): Promise<SecurityScanResult> => {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    try {
      // Check for unusual PII access patterns
      const { data: auditLogs, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('action', 'PII_ACCESS')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (auditLogs) {
        // Check for bulk PII access
        const bulkAccessEvents = auditLogs.filter(log => {
          if (log.details && typeof log.details === 'object' && log.details !== null) {
            const details = log.details as any;
            return details.access_type === 'LIST_VIEW';
          }
          return false;
        });

        if (bulkAccessEvents.length > 20) {
          findings.push({
            type: 'excessive_pii_access',
            severity: 'high',
            description: `${bulkAccessEvents.length} acessos em massa a dados pessoais nas últimas 24h`,
            recommendation: 'Verificar se o acesso é legítimo e necessário',
            count: bulkAccessEvents.length
          });
        }

        // Check for access outside business hours
        const offHoursAccess = auditLogs.filter(log => {
          const hour = new Date(log.created_at).getHours();
          return hour < 6 || hour > 22;
        });

        if (offHoursAccess.length > 5) {
          findings.push({
            type: 'off_hours_pii_access',
            severity: 'medium',
            description: `${offHoursAccess.length} acessos a dados pessoais fora do horário comercial`,
            recommendation: 'Verificar justificativa para acesso fora do horário',
            count: offHoursAccess.length
          });
        }
      }

      const riskLevel = findings.some(f => f.severity === 'critical') ? 'critical' :
                      findings.some(f => f.severity === 'high') ? 'high' :
                      findings.some(f => f.severity === 'medium') ? 'medium' : 'low';

      return {
        id: crypto.randomUUID(),
        scanType: 'data_access',
        status: 'completed',
        riskLevel,
        findings,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        id: crypto.randomUUID(),
        scanType: 'data_access',
        status: 'failed',
        riskLevel: 'low',
        findings: [{
          type: 'scan_error',
          severity: 'medium',
          description: 'Falha ao analisar padrões de acesso a dados',
          recommendation: 'Verificar logs e permissões do sistema'
        }],
        duration: Date.now() - startTime
      };
    }
  };

  const scanAuthentication = async (): Promise<SecurityScanResult> => {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    try {
      // Check for weak authentication patterns
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('*');

      if (error) throw error;

      if (userRoles) {
        const adminCount = userRoles.filter(role => role.role === 'admin').length;
        
        if (adminCount > 3) {
          findings.push({
            type: 'excessive_admin_accounts',
            severity: 'medium',
            description: `${adminCount} contas de administrador encontradas`,
            recommendation: 'Revisar necessidade de múltiplas contas admin',
            count: adminCount
          });
        }

        if (adminCount === 0) {
          findings.push({
            type: 'no_admin_accounts',
            severity: 'critical',
            description: 'Nenhuma conta de administrador encontrada',
            recommendation: 'Criar pelo menos uma conta de administrador'
          });
        }
      }

      const riskLevel = findings.some(f => f.severity === 'critical') ? 'critical' :
                      findings.some(f => f.severity === 'high') ? 'high' :
                      findings.some(f => f.severity === 'medium') ? 'medium' : 'low';

      return {
        id: crypto.randomUUID(),
        scanType: 'authentication',
        status: 'completed',
        riskLevel,
        findings,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        id: crypto.randomUUID(),
        scanType: 'authentication',
        status: 'failed',
        riskLevel: 'low',
        findings: [{
          type: 'scan_error',
          severity: 'medium',
          description: 'Falha ao analisar configuração de autenticação',
          recommendation: 'Verificar logs e permissões do sistema'
        }],
        duration: Date.now() - startTime
      };
    }
  };

  const scanSystemIntegrity = async (): Promise<SecurityScanResult> => {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];

    try {
      // Check security alerts for system integrity issues
      const { data: alerts, error } = await supabase
        .from('security_alerts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (alerts) {
        const unacknowledgedCritical = alerts.filter(alert => 
          !alert.acknowledged && alert.severity === 'critical'
        );

        if (unacknowledgedCritical.length > 0) {
          findings.push({
            type: 'unacknowledged_critical_alerts',
            severity: 'critical',
            description: `${unacknowledgedCritical.length} alertas críticos não reconhecidos`,
            recommendation: 'Revisar e reconhecer alertas críticos pendentes',
            count: unacknowledgedCritical.length
          });
        }

        const highVolumeAlerts = alerts.length > 100;
        if (highVolumeAlerts) {
          findings.push({
            type: 'high_alert_volume',
            severity: 'medium',
            description: `${alerts.length} alertas de segurança na última semana`,
            recommendation: 'Investigar causa do alto volume de alertas',
            count: alerts.length
          });
        }
      }

      const riskLevel = findings.some(f => f.severity === 'critical') ? 'critical' :
                      findings.some(f => f.severity === 'high') ? 'high' :
                      findings.some(f => f.severity === 'medium') ? 'medium' : 'low';

      return {
        id: crypto.randomUUID(),
        scanType: 'system_integrity',
        status: 'completed',
        riskLevel,
        findings,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        id: crypto.randomUUID(),
        scanType: 'system_integrity',
        status: 'failed',
        riskLevel: 'low',
        findings: [{
          type: 'scan_error',
          severity: 'medium',
          description: 'Falha ao verificar integridade do sistema',
          recommendation: 'Verificar logs e conectividade do banco de dados'
        }],
        duration: Date.now() - startTime
      };
    }
  };

  const createSecurityAlert = async (findings: SecurityFinding[]) => {
    try {
      await supabase.rpc('create_security_alert', {
        p_alert_type: 'SECURITY_SCAN_CRITICAL',
        p_severity: 'critical',
        p_title: 'Scan de Segurança: Problemas Críticos Detectados',
        p_description: `Encontrados ${findings.length} problemas críticos durante o scan automático de segurança`,
        p_metadata: JSON.parse(JSON.stringify({ 
          findings: findings.map(f => ({
            type: f.type,
            severity: f.severity,
            description: f.description,
            recommendation: f.recommendation || null,
            affectedResource: f.affectedResource || null,
            count: f.count || null
          })), 
          scan_timestamp: new Date().toISOString() 
        }))
      });
    } catch (error) {
      console.error('Failed to create security alert:', sanitizeForLogging(error));
    }
  };

  const performAutomatedScan = async () => {
    try {
      console.info('Starting automated security scan...');
      await performComprehensiveScan();
      console.info('Automated security scan completed');
    } catch (error) {
      console.error('Automated security scan failed:', sanitizeForLogging(error));
    }
  };

  const enableAutoScan = () => {
    setAutoScanEnabled(true);
    toast.success('Scan automatizado de segurança ativado');
  };

  const disableAutoScan = () => {
    setAutoScanEnabled(false);
    toast.info('Scan automatizado de segurança desativado');
  };

  return {
    scanning,
    lastScanResults,
    autoScanEnabled,
    performComprehensiveScan,
    enableAutoScan,
    disableAutoScan,
    isAuthorized: isAdmin()
  };
}
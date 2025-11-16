import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityAlerts } from './useSecurityAlerts';
import { useSecurityMonitoring } from './useSecurityMonitoring';
import { useUserRole } from './useUserRole';

interface SecurityMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  unacknowledgedAlerts: number;
  recentAuthAttempts: number;
  failedAuthAttempts: number;
  recentPIIAccess: number;
  suspiciousActivity: number;
}

interface SecurityEvent {
  id: string;
  action: string;
  resource_type: string;
  user_id: string;
  created_at: string;
  details?: any;
}

export function useSecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalAlerts: 0,
    criticalAlerts: 0,
    unacknowledgedAlerts: 0,
    recentAuthAttempts: 0,
    failedAuthAttempts: 0,
    recentPIIAccess: 0,
    suspiciousActivity: 0,
  });
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { alerts, getUnacknowledgedCount, getCriticalAlertsCount } = useSecurityAlerts();
  const { fetchSecurityEvents } = useSecurityMonitoring();
  const { isAdmin, userRole } = useUserRole();

  const fetchSecurityMetrics = async () => {
    if (!isAdmin()) return;
    
    setLoading(true);
    try {
      // Get alert metrics
      const totalAlerts = alerts.length;
      const criticalAlerts = getCriticalAlertsCount();
      const unacknowledgedAlerts = getUnacknowledgedCount();

      // Get recent auth attempts (last 24 hours)
      const { data: authAttempts, error: authError } = await supabase
        .from('auth_attempts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (authError) throw authError;

      const recentAuthAttempts = authAttempts?.length || 0;
      const failedAuthAttempts = authAttempts?.filter(attempt => !attempt.success).length || 0;

      // Get recent security events
      const { data: securityEvents, error: eventsError } = await supabase
        .from('security_audit_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (eventsError) throw eventsError;

      setRecentEvents(securityEvents || []);

      // Count PII access events
      const recentPIIAccess = securityEvents?.filter(event => 
        event.action === 'PII_ACCESS'
      ).length || 0;

      // Detect suspicious activity patterns
      const suspiciousActivity = detectSuspiciousPatterns(authAttempts || [], securityEvents || []);

      setMetrics({
        totalAlerts,
        criticalAlerts,
        unacknowledgedAlerts,
        recentAuthAttempts,
        failedAuthAttempts,
        recentPIIAccess,
        suspiciousActivity,
      });

    } catch (error) {
      console.error('Error fetching security metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectSuspiciousPatterns = (authAttempts: any[], securityEvents: any[]): number => {
    let suspiciousCount = 0;

    // Pattern 1: Multiple failed logins from same IP
    const ipAttempts = authAttempts.reduce((acc, attempt) => {
      if (!attempt.success) {
        acc[attempt.ip_address] = (acc[attempt.ip_address] || 0) + 1;
      }
      return acc;
    }, {});

    Object.values(ipAttempts).forEach((count: any) => {
      if (count >= 5) suspiciousCount++;
    });

    // Pattern 2: Bulk PII access
    const bulkPIIAccess = securityEvents.filter(event => 
      event.action === 'PII_ACCESS' && 
      event.details?.access_type?.includes('BULK')
    ).length;

    suspiciousCount += bulkPIIAccess;

    // Pattern 3: Off-hours activity (outside 8 AM - 6 PM)
    const offHoursActivity = securityEvents.filter(event => {
      const hour = new Date(event.created_at).getHours();
      return hour < 8 || hour > 18;
    }).length;

    if (offHoursActivity > 10) suspiciousCount++;

    return suspiciousCount;
  };

  const generateSecurityReport = async () => {
    if (!isAdmin()) return null;

    try {
      const reportData = {
        generatedAt: new Date().toISOString(),
        metrics,
        recentEvents: recentEvents.slice(0, 20),
        recommendations: generateRecommendations(),
      };

      return reportData;
    } catch (error) {
      console.error('Error generating security report:', error);
      return null;
    }
  };

  const generateRecommendations = () => {
    const recommendations = [];

    if (metrics.failedAuthAttempts > 20) {
      recommendations.push({
        priority: 'high',
        title: 'Alto número de tentativas de login falhadas',
        description: 'Considere implementar bloqueio temporário de IP para prevenir ataques de força bruta.',
      });
    }

    if (metrics.unacknowledgedAlerts > 5) {
      recommendations.push({
        priority: 'medium',
        title: 'Alertas não reconhecidos',
        description: 'Existem alertas de segurança que precisam ser revisados e reconhecidos.',
      });
    }

    if (metrics.recentPIIAccess > 50) {
      recommendations.push({
        priority: 'medium',
        title: 'Alto acesso a dados pessoais',
        description: 'Monitore o acesso a informações pessoais e verifique se está dentro do esperado.',
      });
    }

    if (metrics.suspiciousActivity > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Atividade suspeita detectada',
        description: 'Foram detectados padrões de comportamento suspeito que requerem investigação.',
      });
    }

    return recommendations;
  };

  useEffect(() => {
    if (isAdmin()) {
      fetchSecurityMetrics();
      // Refresh metrics every 5 minutes
      const interval = setInterval(fetchSecurityMetrics, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userRole, alerts]);

  return {
    metrics,
    recentEvents,
    loading,
    fetchSecurityMetrics,
    generateSecurityReport,
    generateRecommendations,
    isAuthorized: isAdmin(),
  };
}
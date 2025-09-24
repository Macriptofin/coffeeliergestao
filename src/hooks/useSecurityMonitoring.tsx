import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

interface SecurityEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  timestamp: string;
  userId?: string;
  ipAddress?: string;
}

export function useSecurityMonitoring() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAdmin } = useUserRole();

  const logSecurityEvent = async (
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any
  ) => {
    try {
      const ipAddress = await getClientIP();
      
      await supabase.rpc('log_sensitive_data_access', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_details: {
          ...details,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      // Create security alert for high-risk actions
      if (isHighRiskAction(action)) {
        await createSecurityAlert(action, resourceType, details);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  };

  const logPIIAccess = async (
    employeeId: string,
    accessType: string,
    fields: string[]
  ) => {
    try {
      await supabase.rpc('log_pii_access', {
        p_table_name: 'employees',
        p_employee_id: employeeId,
        p_access_type: accessType,
        p_pii_fields: fields
      });

      // Alert on bulk PII access
      if (fields.length > 3 || accessType === 'BULK_EXPORT') {
        await createSecurityAlert(
          'BULK_PII_ACCESS',
          'employees',
          {
            employee_id: employeeId,
            fields_accessed: fields,
            access_type: accessType
          }
        );
      }
    } catch (error) {
      console.error('Failed to log PII access:', error);
    }
  };

  const createSecurityAlert = async (
    alertType: string,
    resourceType: string,
    metadata?: any
  ) => {
    try {
      const severity = getSeverityForAction(alertType);
      const title = getAlertTitle(alertType);
      const description = getAlertDescription(alertType, resourceType, metadata);
      const ipAddress = await getClientIP();

      await supabase.rpc('create_security_alert', {
        p_alert_type: alertType,
        p_severity: severity,
        p_title: title,
        p_description: description,
        p_ip_address: ipAddress,
        p_metadata: metadata
      });
    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  };

  const getClientIP = async (): Promise<string> => {
    try {
      // In production, this would come from request headers
      // For now, using a placeholder
      return '127.0.0.1';
    } catch {
      return 'unknown';
    }
  };

  const isHighRiskAction = (action: string): boolean => {
    const highRiskActions = [
      'BULK_PII_ACCESS',
      'SALARY_ACCESS',
      'EMPLOYEE_DELETE',
      'CLIENT_DELETE',
      'FINANCIAL_DATA_ACCESS',
      'ADMIN_ROLE_GRANTED',
      'PASSWORD_RESET_ATTEMPT',
      'MULTIPLE_FAILED_LOGIN'
    ];
    return highRiskActions.includes(action);
  };

  const getSeverityForAction = (action: string): string => {
    const criticalActions = ['ADMIN_ROLE_GRANTED', 'BULK_PII_ACCESS'];
    const highActions = ['SALARY_ACCESS', 'EMPLOYEE_DELETE', 'CLIENT_DELETE'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    return 'medium';
  };

  const getAlertTitle = (alertType: string): string => {
    const titles: Record<string, string> = {
      'BULK_PII_ACCESS': 'Acesso em massa a dados pessoais',
      'SALARY_ACCESS': 'Acesso a informações salariais',
      'EMPLOYEE_DELETE': 'Exclusão de funcionário',
      'CLIENT_DELETE': 'Exclusão de cliente',
      'FINANCIAL_DATA_ACCESS': 'Acesso a dados financeiros',
      'ADMIN_ROLE_GRANTED': 'Permissão de administrador concedida',
      'PASSWORD_RESET_ATTEMPT': 'Tentativa de redefinição de senha',
      'MULTIPLE_FAILED_LOGIN': 'Múltiplas tentativas de login falhadas'
    };
    return titles[alertType] || 'Atividade de segurança detectada';
  };

  const getAlertDescription = (
    alertType: string,
    resourceType: string,
    metadata?: any
  ): string => {
    switch (alertType) {
      case 'BULK_PII_ACCESS':
        return `Acesso a múltiplos campos de dados pessoais do funcionário. Campos: ${metadata?.fields_accessed?.join(', ') || 'N/A'}`;
      case 'SALARY_ACCESS':
        return `Acesso a informações salariais de funcionário ID: ${metadata?.employee_id || 'N/A'}`;
      case 'EMPLOYEE_DELETE':
        return `Exclusão do funcionário: ${metadata?.employee_name || 'N/A'}`;
      default:
        return `Atividade detectada em ${resourceType}`;
    }
  };

  const fetchSecurityEvents = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Transform database records to match SecurityEvent interface
      const transformedEvents: SecurityEvent[] = (data || []).map(record => ({
        id: record.id,
        action: record.action,
        resourceType: record.resource_type || 'unknown',
        resourceId: record.resource_id,
        details: record.details,
        timestamp: record.created_at,
        userId: record.user_id,
        ipAddress: record.ip_address
      }));
      
      setEvents(transformedEvents);
    } catch (error) {
      console.error('Failed to fetch security events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSecurityEvents();
    }
  }, [isAdmin]);

  return {
    events,
    loading,
    logSecurityEvent,
    logPIIAccess,
    createSecurityAlert,
    fetchSecurityEvents
  };
}
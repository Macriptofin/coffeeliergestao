import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { getClientIP, sanitizeForLogging, isSecurityMonitoringDisabled } from '@/lib/security-utils';

interface SecurityAlert {
  id: string;
  alert_type: 'multiple_failed_login' | 'suspicious_ip' | 'role_change' | 'financial_access' | 'pii_bulk_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  user_id?: string;
  ip_address?: string;
  metadata?: any;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export function useSecurityAlerts() {
  const { isAdminOrManager, userRole } = useUserRole();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdminOrManager()) {
      fetchAlerts();
      setupRealTimeSubscription();
    } else {
      setAlerts([]);
      setLoading(false);
    }
  }, [userRole]);

  const fetchAlerts = async () => {
    if (!isAdminOrManager()) return;
    
    // Extra safety: ensure we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching security alerts:', sanitizeForLogging(error));
        return;
      }

      setAlerts((data || []) as SecurityAlert[]);
    } catch (error) {
      console.error('Error in fetchAlerts:', sanitizeForLogging(error));
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeSubscription = () => {
    const subscription = supabase
      .channel('security_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts'
        },
        (payload) => {
          setAlerts(current => [payload.new as SecurityAlert, ...current]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const acknowledgeAlert = async (alertId: string) => {
    if (isSecurityMonitoringDisabled()) return false;
    try {
      const ipAddress = await getClientIP();
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('security_alerts')
        .update({ 
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id
        })
        .eq('id', alertId);

      if (error) {
        console.error('Error acknowledging alert:', sanitizeForLogging(error));
        return false;
      }

      // Log the acknowledgment for audit trail
      await supabase.rpc('log_sensitive_data_access', {
        p_action: 'ALERT_ACKNOWLEDGED',
        p_resource_type: 'security_alerts',
        p_resource_id: alertId,
        p_details: {
          ip_address: ipAddress,
          timestamp: new Date().toISOString(),
          user_id: user?.id
        }
      });

      // Update local state
      setAlerts(current =>
        current.map(alert =>
          alert.id === alertId
            ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id }
            : alert
        )
      );

      return true;
    } catch (error) {
      console.error('Error in acknowledgeAlert:', sanitizeForLogging(error));
      return false;
    }
  };

  const getUnacknowledgedCount = (): number => {
    return alerts.filter(alert => !alert.acknowledged).length;
  };

  const getCriticalAlertsCount = (): number => {
    return alerts.filter(alert => !alert.acknowledged && alert.severity === 'critical').length;
  };

  const getHighPriorityAlertsCount = (): number => {
    return alerts.filter(alert => !alert.acknowledged && (alert.severity === 'high' || alert.severity === 'critical')).length;
  };

  return {
    alerts,
    loading,
    fetchAlerts,
    acknowledgeAlert,
    getUnacknowledgedCount,
    getCriticalAlertsCount,
    getHighPriorityAlertsCount
  };
}
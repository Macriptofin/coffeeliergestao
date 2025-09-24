import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

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
  const { isAdminOrManager } = useUserRole();
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
  }, [isAdminOrManager()]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching security alerts:', error);
        return;
      }

      setAlerts((data || []) as SecurityAlert[]);
    } catch (error) {
      console.error('Error in fetchAlerts:', error);
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
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ 
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) {
        console.error('Error acknowledging alert:', error);
        return false;
      }

      // Update local state
      setAlerts(current =>
        current.map(alert =>
          alert.id === alertId
            ? { ...alert, acknowledged: true, acknowledged_at: new Date().toISOString() }
            : alert
        )
      );

      return true;
    } catch (error) {
      console.error('Error in acknowledgeAlert:', error);
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
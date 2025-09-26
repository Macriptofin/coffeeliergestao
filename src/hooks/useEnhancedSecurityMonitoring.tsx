import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { getClientIP, sanitizeForLogging } from '@/lib/security-utils';
import { toast } from 'sonner';

interface PIIAnomalyData {
  id: string;
  user_id: string;
  anomaly_type: string;
  severity: string;
  detection_time: string;
  details: any;
  ip_address?: string;
  resource_type: string;
  resource_count: number;
  is_investigated: boolean;
  investigated_by?: string;
  investigated_at?: string;
  investigation_notes?: string;
}

interface AccountLockout {
  id: string;
  user_email: string;
  locked_at: string;
  locked_until: string;
  failed_attempts: number;
  lock_reason: string;
  unlock_method?: string;
  unlocked_at?: string;
  unlocked_by?: string;
}

export function useEnhancedSecurityMonitoring() {
  const { isAdminOrManager, isAdmin } = useUserRole();
  const [piiAnomalies, setPiiAnomalies] = useState<PIIAnomalyData[]>([]);
  const [accountLockouts, setAccountLockouts] = useState<AccountLockout[]>([]);
  const [loading, setLoading] = useState(false);

  // Enhanced PII access logging with anomaly detection
  const logPIIAccessWithAnomalyDetection = async (
    resourceId: string | null,
    accessType: string,
    fields: string[],
    resourceType: string = 'clients'
  ) => {
    try {
      const ipAddress = await getClientIP();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Log the access
      await supabase.rpc('log_sensitive_data_access', {
        p_action: 'PII_ACCESS',
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_details: {
          access_type: accessType,
          fields: fields,
          ip_address: ipAddress,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      });

      // Trigger anomaly detection
      await supabase.rpc('detect_pii_anomaly', {
        p_user_id: user.id,
        p_resource_type: resourceType,
        p_access_count: 1
      });

    } catch (error) {
      console.error('Error logging PII access:', sanitizeForLogging(error));
    }
  };

  // Check account lockout status
  const checkAccountLockout = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('check_account_lockout', {
        p_email: email
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking account lockout:', sanitizeForLogging(error));
      return { is_locked: false };
    }
  };

  // Create account lockout
  const createAccountLockout = async (
    email: string,
    failedAttempts: number = 5,
    lockoutDurationMinutes: number = 30
  ) => {
    try {
      await supabase.rpc('create_account_lockout', {
        p_email: email,
        p_failed_attempts: failedAttempts,
        p_lockout_duration_minutes: lockoutDurationMinutes
      });

      toast.error(`Conta ${email} bloqueada por ${lockoutDurationMinutes} minutos`);
      
      // Refresh lockouts list
      fetchAccountLockouts();
    } catch (error) {
      console.error('Error creating account lockout:', sanitizeForLogging(error));
      throw error;
    }
  };

  // Unlock account (admin only)
  const unlockAccount = async (lockoutId: string) => {
    if (!isAdmin) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('account_lockouts')
        .update({
          unlocked_at: new Date().toISOString(),
          unlocked_by: user?.id,
          unlock_method: 'admin_unlock'
        })
        .eq('id', lockoutId);

      if (error) throw error;

      toast.success('Conta desbloqueada com sucesso');
      fetchAccountLockouts();
      return true;
    } catch (error) {
      console.error('Error unlocking account:', sanitizeForLogging(error));
      toast.error('Erro ao desbloquear conta');
      return false;
    }
  };

  // Fetch PII anomalies
  const fetchPIIAnomalies = async () => {
    if (!isAdminOrManager) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pii_access_anomalies')
        .select('*')
        .order('detection_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPiiAnomalies(data || []);
    } catch (error) {
      console.error('Error fetching PII anomalies:', sanitizeForLogging(error));
    } finally {
      setLoading(false);
    }
  };

  // Fetch account lockouts
  const fetchAccountLockouts = async () => {
    if (!isAdminOrManager) return;

    try {
      const { data, error } = await supabase
        .from('account_lockouts')
        .select('*')
        .order('locked_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAccountLockouts(data || []);
    } catch (error) {
      console.error('Error fetching account lockouts:', sanitizeForLogging(error));
    }
  };

  // Investigate PII anomaly (admin only)
  const investigatePIIAnomaly = async (
    anomalyId: string,
    notes: string
  ) => {
    if (!isAdmin) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('pii_access_anomalies')
        .update({
          is_investigated: true,
          investigated_by: user?.id,
          investigated_at: new Date().toISOString(),
          investigation_notes: notes
        })
        .eq('id', anomalyId);

      if (error) throw error;

      toast.success('Anomalia investigada com sucesso');
      fetchPIIAnomalies();
      return true;
    } catch (error) {
      console.error('Error investigating PII anomaly:', sanitizeForLogging(error));
      toast.error('Erro ao investigar anomalia');
      return false;
    }
  };

  // Get security metrics for dashboard
  const getSecurityMetrics = async () => {
    if (!isAdminOrManager) return null;

    try {
      const [anomaliesResult, lockoutsResult] = await Promise.all([
        supabase
          .from('pii_access_anomalies')
          .select('severity, is_investigated')
          .gte('detection_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('account_lockouts')
          .select('lock_reason')
          .gte('locked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const anomalies = anomaliesResult.data || [];
      const lockouts = lockoutsResult.data || [];

      return {
        totalAnomalies: anomalies.length,
        highSeverityAnomalies: anomalies.filter(a => a.severity === 'high' || a.severity === 'critical').length,
        uninvestigatedAnomalies: anomalies.filter(a => !a.is_investigated).length,
        weeklyLockouts: lockouts.length,
        activeLockouts: accountLockouts.filter(l => new Date(l.locked_until) > new Date() && !l.unlocked_at).length
      };
    } catch (error) {
      console.error('Error fetching security metrics:', sanitizeForLogging(error));
      return null;
    }
  };

  // Set up real-time subscriptions for anomalies and lockouts
  useEffect(() => {
    if (isAdminOrManager) {
      fetchPIIAnomalies();
      fetchAccountLockouts();

      // Subscribe to new anomalies
      const anomaliesSubscription = supabase
        .channel('pii_anomalies')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'pii_access_anomalies' 
          }, 
          (payload) => {
            setPiiAnomalies(current => [payload.new as PIIAnomalyData, ...current]);
            
            // Show notification for high severity anomalies
            const anomaly = payload.new as PIIAnomalyData;
            if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
              toast.error(`Anomalia de segurança detectada: ${anomaly.anomaly_type}`);
            }
          }
        )
        .subscribe();

      // Subscribe to new lockouts
      const lockoutsSubscription = supabase
        .channel('account_lockouts')
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'account_lockouts'
          },
          (payload) => {
            setAccountLockouts(current => [payload.new as AccountLockout, ...current]);
            toast.warning('Nova conta bloqueada por segurança');
          }
        )
        .subscribe();

      return () => {
        anomaliesSubscription.unsubscribe();
        lockoutsSubscription.unsubscribe();
      };
    }
  }, [isAdminOrManager]);

  return {
    piiAnomalies,
    accountLockouts,
    loading,
    logPIIAccessWithAnomalyDetection,
    checkAccountLockout,
    createAccountLockout,
    unlockAccount,
    fetchPIIAnomalies,
    fetchAccountLockouts,
    investigatePIIAnomaly,
    getSecurityMetrics,
    isAuthorized: isAdminOrManager
  };
}
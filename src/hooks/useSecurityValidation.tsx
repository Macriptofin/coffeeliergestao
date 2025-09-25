import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityMonitoring } from './useSecurityMonitoring';
import { validateAuthenticatedAction } from '@/lib/security-utils';

/**
 * Hook for additional security validation and monitoring
 */
export function useSecurityValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const { logSecurityEvent, createSecurityAlert } = useSecurityMonitoring();

  /**
   * Validate sensitive operations before execution
   */
  const validateSensitiveOperation = useCallback(async (
    operationType: string,
    resourceType: string,
    resourceId?: string
  ): Promise<{ allowed: boolean; reason?: string }> => {
    setIsValidating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!validateAuthenticatedAction(user?.id || null)) {
        return { allowed: false, reason: 'Authentication required' };
      }

      // Log the validation attempt
      await logSecurityEvent(
        `VALIDATE_${operationType}`,
        resourceType,
        resourceId,
        { operation_type: operationType }
      );

      // Check for suspicious patterns
      const suspiciousActivity = await checkSuspiciousActivity(user!.id, operationType);
      if (suspiciousActivity.detected) {
        await createSecurityAlert(
          'SUSPICIOUS_ACTIVITY',
          resourceType,
          {
            user_id: user!.id,
            operation_type: operationType,
            reason: suspiciousActivity.reason
          }
        );
        return { allowed: false, reason: suspiciousActivity.reason };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Security validation failed:', error);
      // Fail secure - deny access if validation fails
      return { allowed: false, reason: 'Validation system error' };
    } finally {
      setIsValidating(false);
    }
  }, [logSecurityEvent, createSecurityAlert]);

  /**
   * Check for suspicious activity patterns
   */
  const checkSuspiciousActivity = async (
    userId: string,
    operationType: string
  ): Promise<{ detected: boolean; reason?: string }> => {
    try {
      // Check for rapid successive operations (potential automation/attack)
      const { data: recentLogs } = await supabase
        .from('security_audit_log')
        .select('created_at, action')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentLogs && recentLogs.length > 8) {
        return {
          detected: true,
          reason: 'Excessive activity detected - possible automated behavior'
        };
      }

      // Check for unusual time patterns (operations outside normal hours)
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 22) {
        const { data: offHoursActivity } = await supabase
          .from('security_audit_log')
          .select('created_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .limit(1);

        if (offHoursActivity && offHoursActivity.length === 0) {
          // First time this user operates outside normal hours
          await logSecurityEvent(
            'OFF_HOURS_ACCESS',
            'system',
            undefined,
            { hour: currentHour, operation: operationType }
          );
        }
      }

      return { detected: false };
    } catch (error) {
      console.error('Suspicious activity check failed:', error);
      return { detected: false };
    }
  };

  /**
   * Validate file upload security
   */
  const validateFileUpload = useCallback((
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ): { valid: boolean; reason?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, reason: 'Tipo de arquivo não permitido' };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, reason: 'Arquivo muito grande (máximo 10MB)' };
    }

    // Check for suspicious file names
    const suspiciousPatterns = [
      /\.(php|js|html|htm|asp|aspx|jsp)$/i,
      /^\./, // Hidden files
      /[<>:"\/\\|?*]/, // Invalid characters
      /^\s*$/, // Empty or whitespace-only names
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.name)) {
        return { valid: false, reason: 'Nome de arquivo suspeito ou inválido' };
      }
    }

    return { valid: true };
  }, []);

  /**
   * Generate security report for current user session
   */
  const generateSecurityReport = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [authAttempts, securityEvents, alerts] = await Promise.all([
        // Recent auth attempts
        supabase
          .from('auth_attempts')
          .select('*')
          .eq('email', user.email)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('created_at', { ascending: false }),
        
        // Recent security events
        supabase
          .from('security_audit_log')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('created_at', { ascending: false }),
        
        // Security alerts related to this user
        supabase
          .from('security_alerts')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('created_at', { ascending: false })
      ]);

      return {
        userId: user.id,
        email: user.email,
        reportGeneratedAt: new Date().toISOString(),
        authAttempts: {
          total: authAttempts.data?.length || 0,
          successful: authAttempts.data?.filter(a => a.success)?.length || 0,
          failed: authAttempts.data?.filter(a => !a.success)?.length || 0,
          recent: authAttempts.data?.slice(0, 5) || []
        },
        securityEvents: {
          total: securityEvents.data?.length || 0,
          recent: securityEvents.data?.slice(0, 10) || []
        },
        securityAlerts: {
          total: alerts.data?.length || 0,
          critical: alerts.data?.filter(a => a.severity === 'critical')?.length || 0,
          high: alerts.data?.filter(a => a.severity === 'high')?.length || 0,
          recent: alerts.data?.slice(0, 5) || []
        }
      };
    } catch (error) {
      console.error('Failed to generate security report:', error);
      return null;
    }
  }, []);

  return {
    validateSensitiveOperation,
    validateFileUpload,
    generateSecurityReport,
    isValidating
  };
}
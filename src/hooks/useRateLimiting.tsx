import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getClientIP, sanitizeForLogging } from '@/lib/security-utils';

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  retry_after?: string;
}

export function useRateLimiting() {
  const [isChecking, setIsChecking] = useState(false);

  const checkRateLimit = async (
    email: string,
    attemptType: 'signin' | 'signup' | 'password_reset'
  ): Promise<RateLimitResult> => {
    if (!email) {
      return { allowed: true };
    }

    setIsChecking(true);

    try {
      // Get real client IP address
      const ipAddress = await getClientIP();
      
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_email: email,
        p_ip_address: ipAddress,
        p_attempt_type: attemptType
      });

      if (error) {
        console.warn('Rate limit check failed, allowing attempt:', sanitizeForLogging(error));
        return { allowed: true };
      }

      return (data || { allowed: true }) as unknown as RateLimitResult;
    } catch (error) {
      console.error('Rate limiting error:', sanitizeForLogging(error));
      // Fail open for availability
      return { allowed: true };
    } finally {
      setIsChecking(false);
    }
  };

  const logAuthAttempt = async (
    email: string,
    attemptType: 'signin' | 'signup' | 'password_reset',
    success: boolean,
    failureReason?: string
  ) => {
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;

      await supabase.rpc('log_auth_attempt', {
        p_email: email,
        p_ip_address: ipAddress,
        p_attempt_type: attemptType,
        p_success: success,
        p_user_agent: userAgent,
        p_failure_reason: failureReason
      });
    } catch (error) {
      console.error('Failed to log auth attempt:', sanitizeForLogging(error));
      // Don't throw - logging failures shouldn't block auth
    }
  };

  return {
    checkRateLimit,
    logAuthAttempt,
    isChecking
  };
}
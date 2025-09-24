import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      // Get client IP (best effort - fallback to placeholder)
      const ipAddress = '127.0.0.1'; // In production, this would come from headers
      
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_email: email,
        p_ip_address: ipAddress,
        p_attempt_type: attemptType
      });

      if (error) {
        console.warn('Rate limit check failed, allowing attempt:', error);
        return { allowed: true };
      }

      return (data || { allowed: true }) as unknown as RateLimitResult;
    } catch (error) {
      console.error('Rate limiting error:', error);
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
      const ipAddress = '127.0.0.1'; // In production, this would come from headers
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
      console.error('Failed to log auth attempt:', error);
      // Don't throw - logging failures shouldn't block auth
    }
  };

  return {
    checkRateLimit,
    logAuthAttempt,
    isChecking
  };
}
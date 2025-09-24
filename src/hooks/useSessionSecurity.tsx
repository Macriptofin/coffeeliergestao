import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

interface SessionState {
  lastActivity: number;
  warningShown: boolean;
  isActive: boolean;
}

export function useSessionSecurity() {
  const [sessionState, setSessionState] = useState<SessionState>({
    lastActivity: Date.now(),
    warningShown: false,
    isActive: true
  });

  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [warningTimeout, setWarningTimeout] = useState<NodeJS.Timeout | null>(null);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    setSessionState(prev => ({
      ...prev,
      lastActivity: now,
      warningShown: false
    }));
    
    // Reset timeouts
    if (sessionTimeout) clearTimeout(sessionTimeout);
    if (warningTimeout) clearTimeout(warningTimeout);
    
    // Set warning timeout (25 minutes)
    const newWarningTimeout = setTimeout(() => {
      setSessionState(prev => ({ ...prev, warningShown: true }));
      showSessionWarning();
    }, SESSION_TIMEOUT - WARNING_TIME);
    
    // Set session timeout (30 minutes)
    const newSessionTimeout = setTimeout(() => {
      handleSessionExpiry();
    }, SESSION_TIMEOUT);
    
    setWarningTimeout(newWarningTimeout);
    setSessionTimeout(newSessionTimeout);
  }, [sessionTimeout, warningTimeout]);

  const showSessionWarning = () => {
    toast.warning('Sua sessão expirará em 5 minutos', {
      duration: 10000,
      action: {
        label: 'Manter Ativo',
        onClick: () => {
          updateActivity();
          toast.success('Sessão renovada');
        }
      }
    });
  };

  const handleSessionExpiry = async () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    
    try {
      await supabase.auth.signOut();
      toast.error('Sessão expirada por inatividade. Faça login novamente.');
      
      // Redirect to login
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error during session expiry:', error);
    }
  };

  const extendSession = () => {
    updateActivity();
  };

  const terminateSession = async () => {
    try {
      await supabase.auth.signOut();
      setSessionState(prev => ({ ...prev, isActive: false }));
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error terminating session:', error);
    }
  };

  // Track user activity
  useEffect(() => {
    const activities = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const throttledUpdate = throttle(updateActivity, 30000); // Update max once per 30 seconds

    activities.forEach(activity => {
      document.addEventListener(activity, throttledUpdate, true);
    });

    return () => {
      activities.forEach(activity => {
        document.removeEventListener(activity, throttledUpdate, true);
      });
      if (sessionTimeout) clearTimeout(sessionTimeout);
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [updateActivity, sessionTimeout, warningTimeout]);

  // Initialize session on mount
  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // Monitor authentication state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setSessionState(prev => ({ ...prev, isActive: false }));
        } else if (event === 'SIGNED_IN' && session) {
          updateActivity();
          setSessionState(prev => ({ ...prev, isActive: true }));
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [updateActivity]);

  return {
    sessionState,
    extendSession,
    terminateSession,
    timeUntilWarning: Math.max(0, SESSION_TIMEOUT - WARNING_TIME - (Date.now() - sessionState.lastActivity)),
    timeUntilExpiry: Math.max(0, SESSION_TIMEOUT - (Date.now() - sessionState.lastActivity))
  };
}

// Throttle function to limit how often updateActivity is called
function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now();

    if (!previous) {
      func(...args);
      previous = now;
      return;
    }

    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      func(...args);
      previous = now;
    } else if (!timeout) {
      timeout = setTimeout(() => {
        func(...args);
        previous = Date.now();
        timeout = null;
      }, remaining);
    }
  };
}
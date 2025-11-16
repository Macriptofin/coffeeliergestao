import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import type { User, Session } from '@supabase/supabase-js';
import { isSecurityMonitoringDisabled } from '@/lib/security-utils';

export function useSecureAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { logSecurityEvent } = useSecurityMonitoring();
  const loginLoggedRef = useRef(false); // Prevent duplicate USER_LOGIN logs

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session recovery error:', error);
          await logSecurityEvent('SESSION_RECOVERY_ERROR', 'auth', undefined, { error: error.message });
        }

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log authentication events (defer to avoid blocking callback)
        if (!isSecurityMonitoringDisabled()) {
          try {
            setTimeout(() => {
              switch (event) {
                case 'SIGNED_IN':
                  // Only log once per session to prevent loops
                  if (!loginLoggedRef.current) {
                    logSecurityEvent('USER_LOGIN', 'auth', session?.user?.id, { method: 'supabase_auth' });
                    loginLoggedRef.current = true;
                  }
                  break;
                case 'SIGNED_OUT':
                  logSecurityEvent('USER_LOGOUT', 'auth', undefined);
                  loginLoggedRef.current = false; // Reset for next session
                  break;
                case 'TOKEN_REFRESHED':
                  // skip to avoid noise
                  break;
                case 'USER_UPDATED':
                  logSecurityEvent('USER_UPDATED', 'auth', session?.user?.id);
                  break;
              }
            }, 0);
          } catch (error) {
            console.error('Failed to log auth event:', error);
          }
        }
      }
    );

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [logSecurityEvent]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear any sensitive data from memory
      setUser(null);
      setSession(null);
      
      // Clear cookies manually as extra security measure
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        if (name.trim().startsWith('coffeelier_auth_')) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
        }
      });
      
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return {
    user,
    session,
    loading,
    signOut
  };
}
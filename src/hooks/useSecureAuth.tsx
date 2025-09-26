import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import type { User, Session } from '@supabase/supabase-js';

export function useSecureAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { logSecurityEvent } = useSecurityMonitoring();

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
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log authentication events
        try {
          switch (event) {
            case 'SIGNED_IN':
              await logSecurityEvent('USER_LOGIN', 'auth', session?.user?.id, {
                method: 'supabase_auth'
              });
              break;
            case 'SIGNED_OUT':
              await logSecurityEvent('USER_LOGOUT', 'auth', user?.id, {
                session_duration: session ? (Date.now() - Date.parse(session.expires_at || new Date().toISOString())) : 0
              });
              break;
            case 'TOKEN_REFRESHED':
              // Don't log token refresh as it's too frequent and not security-relevant
              break;
            case 'USER_UPDATED':
              await logSecurityEvent('USER_UPDATED', 'auth', session?.user?.id);
              break;
          }
        } catch (error) {
          console.error('Failed to log auth event:', error);
        }
      }
    );

    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [logSecurityEvent, user?.id]);

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
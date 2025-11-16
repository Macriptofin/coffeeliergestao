import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'financial' | 'user' | null;

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();

    // Escutar mudanças na autenticação — ignorar TOKEN_REFRESHED para evitar loops
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        checkUserRole();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const lastCheckRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const checkUserRole = async () => {
    try {
      const now = Date.now();
      // Debounce para evitar chamadas em rajada
      if (now - lastCheckRef.current < 5000 && userRole !== null) return;
      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }

      setLoading(true);

      inFlightRef.current = (async () => {
        // Preferir getSession (usa cache local) ao invés de getUser (faz GET /auth/v1/user)
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (!user) {
          setUserRole(null);
          return;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error && error.code !== 'PGRST116') {
          console.error('Erro ao verificar role:', error);
          setUserRole(null);
          return;
        }

        // Se o usuário não tem role definido, considerar como 'user' por padrão
        setUserRole(data && data.length > 0 ? (data[0].role as UserRole) : 'user');
        lastCheckRef.current = now;
      })();

      await inFlightRef.current;
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
      setUserRole(null);
    } finally {
      inFlightRef.current = null;
      setLoading(false);
    }
  };

  const hasRole = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!userRole) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(userRole);
    }
    
    return userRole === requiredRole;
  };

  const isAdmin = (): boolean => hasRole('admin');
  const isAdminOrManager = (): boolean => hasRole(['admin', 'manager']);

  return {
    userRole,
    loading,
    hasRole,
    isAdmin,
    isAdminOrManager,
    refetch: checkUserRole
  };
}
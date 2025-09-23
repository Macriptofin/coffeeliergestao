import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'user' | null;

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
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
      setUserRole(data && data.length > 0 ? data[0].role as UserRole : 'user');
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
      setUserRole(null);
    } finally {
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
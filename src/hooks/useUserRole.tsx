import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'financial' | 'user' | null;

// Módulos e ações do sistema
export type AppModule =
  | 'materiais' | 'compras' | 'vendas' | 'producao'
  | 'financeiro' | 'rh' | 'agenda' | 'fornecedores' | 'config';
export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export function useUserRole() {
  const [userRole,    setUserRole]    = useState<UserRole>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [modulePerms, setModulePerms] = useState<{ module: string; action: string }[]>([]);
  const [loading,     setLoading]     = useState(true);

  const lastCheckRef = useRef(0);
  const inFlightRef  = useRef<Promise<void> | null>(null);

  useEffect(() => {
    checkUserRole();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        checkUserRole();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async () => {
    try {
      const now = Date.now();
      if (now - lastCheckRef.current < 5000 && userRole !== null) return;
      if (inFlightRef.current) { await inFlightRef.current; return; }

      setLoading(true);
      inFlightRef.current = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setUserRole(null); setUserId(null); setModulePerms([]);
          return;
        }

        setUserId(user.id);

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

        const role = (data?.[0]?.role as UserRole) ?? 'user';
        setUserRole(role);

        // Buscar permissões granulares (só para roles não-admin)
        if (!['admin', 'manager'].includes(role)) {
          const { data: perms } = await supabase
            .from('module_permissions')
            .select('module, action')
            .eq('user_id', user.id);
          setModulePerms(perms || []);
        } else {
          setModulePerms([]); // admin/manager têm tudo
        }

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
    if (Array.isArray(requiredRole)) return requiredRole.includes(userRole);
    return userRole === requiredRole;
  };

  // Verificar permissão por módulo + ação
  const can = useCallback((module: AppModule, action: ModuleAction): boolean => {
    if (!userRole) return false;
    if (['admin', 'manager'].includes(userRole)) return true;
    // financial role: acesso total ao módulo financeiro por definição de role
    if (userRole === 'financial' && module === 'financeiro') return true;
    return modulePerms.some(p => p.module === module && p.action === action);
  }, [userRole, modulePerms]);

  const canView    = (module: AppModule) => can(module, 'view');
  const canCreate  = (module: AppModule) => can(module, 'create');
  const canEdit    = (module: AppModule) => can(module, 'edit');
  const canDelete  = (module: AppModule) => can(module, 'delete');
  const canApprove = (module: AppModule) => can(module, 'approve');

  const isAdmin          = (): boolean => hasRole('admin');
  const isAdminOrManager = (): boolean => hasRole(['admin', 'manager']);

  return {
    userRole, userId, loading,
    hasRole, isAdmin, isAdminOrManager,
    can, canView, canCreate, canEdit, canDelete, canApprove,
    modulePerms,
    refetch: checkUserRole,
  };
}

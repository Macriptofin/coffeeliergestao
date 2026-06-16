import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'manager' | 'financial' | 'user' | null;

// Módulos e ações do sistema
export type AppModule =
  | 'materiais' | 'compras' | 'vendas' | 'producao'
  | 'financeiro' | 'rh' | 'agenda' | 'fornecedores' | 'config';
export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

interface RoleData {
  userRole: UserRole;
  userId: string | null;
  modulePerms: { module: string; action: string }[];
}

const USER_ROLE_QUERY_KEY = ['user-role'] as const;

/**
 * Busca role + permissões do usuário atual. Usado como queryFn única e
 * compartilhada via react-query — antes era refeita em cada um dos ~21
 * componentes que chamam useUserRole, causando flash de spinner e dezenas de
 * requests redundantes a cada navegação.
 */
async function fetchUserRole(): Promise<RoleData> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return { userRole: null, userId: null, modulePerms: [] };

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao verificar role:', error);
    return { userRole: null, userId: user.id, modulePerms: [] };
  }

  const role = (data?.[0]?.role as UserRole) ?? 'user';

  // Permissões granulares só para roles não-admin/manager (esses têm tudo)
  let modulePerms: { module: string; action: string }[] = [];
  if (!['admin', 'manager'].includes(role as string)) {
    const { data: perms } = await supabase
      .from('module_permissions')
      .select('module, action')
      .eq('user_id', user.id);
    modulePerms = perms || [];
  }

  return { userRole: role, userId: user.id, modulePerms };
}

export function useUserRole() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: USER_ROLE_QUERY_KEY,
    queryFn: fetchUserRole,
    staleTime: 5 * 60_000,   // 5min frescos — navegação não refaz a busca
    gcTime: 10 * 60_000,
  });

  // Invalida o cache quando o estado de autenticação muda (login/logout/update)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        queryClient.invalidateQueries({ queryKey: USER_ROLE_QUERY_KEY });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const userRole    = data?.userRole ?? null;
  const userId      = data?.userId ?? null;
  // Estabiliza a referência para não recriar o callback `can` a cada render
  const modulePerms = useMemo(() => data?.modulePerms ?? [], [data?.modulePerms]);
  // `loading` só é true enquanto não houver dado em cache; após a 1ª carga,
  // todos os consumidores compartilham o cache e não há mais flash.
  const loading     = isPending;

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
    refetch: () => queryClient.invalidateQueries({ queryKey: USER_ROLE_QUERY_KEY }),
  };
}

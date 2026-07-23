import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';

interface FinancialPermission {
  id: string;
  permission_type: 'view_all' | 'view_department' | 'approve_transactions' | 'manage_budgets';
  department?: string;
  user_id: string;
  created_at: string;
  created_by?: string;
}

const EMPTY_PERMISSIONS: FinancialPermission[] = [];
const FINANCIAL_PERMISSIONS_QUERY_KEY = ['financial-permissions'] as const;

async function fetchFinancialPermissions(): Promise<FinancialPermission[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('financial_permissions')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching financial permissions:', error);
    return [];
  }

  return (data || []) as FinancialPermission[];
}

export function useFinancialPermissions() {
  const queryClient = useQueryClient();
  const { userRole, loading: roleLoading } = useUserRole();

  const { data: permissions = EMPTY_PERMISSIONS, isPending } = useQuery({
    queryKey: FINANCIAL_PERMISSIONS_QUERY_KEY,
    queryFn: fetchFinancialPermissions,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        queryClient.invalidateQueries({ queryKey: FINANCIAL_PERMISSIONS_QUERY_KEY });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const hasFinancialPermission = (
    permissionType: 'view_all' | 'view_department' | 'approve_transactions' | 'manage_budgets',
    department?: string
  ): boolean => {
    // Admins have all permissions
    if (userRole === 'admin') {
      return true;
    }

    // Check if user has specific permission
    return permissions.some(p =>
      p.permission_type === permissionType &&
      (department ? p.department === department || !p.department : true)
    );
  };

  const canViewAllFinancial = (): boolean => hasFinancialPermission('view_all');
  const canViewDepartmentFinancial = (department: string): boolean => hasFinancialPermission('view_department', department);
  const canApproveTransactions = (): boolean => hasFinancialPermission('approve_transactions');
  const canManageBudgets = (): boolean => hasFinancialPermission('manage_budgets');

  const hasAnyFinancialAccess = (): boolean => {
    return userRole === 'admin' ||
           userRole === 'financial' ||
           permissions.length > 0;
  };

  return {
    permissions,
    loading: isPending || roleLoading,
    hasFinancialPermission,
    canViewAllFinancial,
    canViewDepartmentFinancial,
    canApproveTransactions,
    canManageBudgets,
    hasAnyFinancialAccess,
    refetch: () => queryClient.invalidateQueries({ queryKey: FINANCIAL_PERMISSIONS_QUERY_KEY }),
  };
}

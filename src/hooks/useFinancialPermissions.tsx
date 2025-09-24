import { useState, useEffect } from 'react';
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

export function useFinancialPermissions() {
  const { userRole, loading: roleLoading } = useUserRole();
  const [permissions, setPermissions] = useState<FinancialPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading) {
      fetchPermissions();
    }
  }, [roleLoading, userRole]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissions([]);
        return;
      }

      const { data, error } = await supabase
        .from('financial_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching financial permissions:', error);
        setPermissions([]);
        return;
      }

      setPermissions((data || []) as FinancialPermission[]);
    } catch (error) {
      console.error('Error in fetchPermissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

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
    loading: loading || roleLoading,
    hasFinancialPermission,
    canViewAllFinancial,
    canViewDepartmentFinancial,
    canApproveTransactions,
    canManageBudgets,
    hasAnyFinancialAccess,
    refetch: fetchPermissions
  };
}
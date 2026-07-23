import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type HRPermissionType =
  | 'view_basic_info'
  | 'view_personal_documents'
  | 'view_financial_info'
  | 'full_access';

interface HRPermission {
  id: string;
  user_id: string;
  permission_type: HRPermissionType;
  granted_by: string | null;
  created_at: string;
  user_email?: string;
}

const EMPTY_PERMISSIONS: HRPermission[] = [];
const HR_PERMISSIONS_QUERY_KEY = ['hr-permissions'] as const;

async function fetchHRPermissions(): Promise<HRPermission[]> {
  const { data, error } = await supabase
    .from('hr_permissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Buscar emails dos usuários separadamente
  const userIds = data.map(p => p.user_id);
  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('user_id, email')
    .in('user_id', userIds);

  const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.email]));
  return data.map(permission => ({
    ...permission,
    user_email: profilesMap.get(permission.user_id) || 'Unknown',
  }));
}

export function useHRPermissions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: permissions = EMPTY_PERMISSIONS, isPending: loading } = useQuery({
    queryKey: HR_PERMISSIONS_QUERY_KEY,
    queryFn: fetchHRPermissions,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: HR_PERMISSIONS_QUERY_KEY });

  const grantPermission = async (userId: string, permissionType: HRPermissionType) => {
    try {
      const { error } = await supabase
        .from('hr_permissions')
        .insert({
          user_id: userId,
          permission_type: permissionType,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: 'Permissão concedida',
        description: 'O usuário agora tem acesso aos dados de RH.',
      });

      invalidate();
    } catch (error: any) {
      console.error('Error granting permission:', error);
      toast({
        title: 'Erro ao conceder permissão',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const revokePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('hr_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: 'Permissão revogada',
        description: 'O usuário não tem mais acesso aos dados de RH.',
      });

      invalidate();
    } catch (error: any) {
      console.error('Error revoking permission:', error);
      toast({
        title: 'Erro ao revogar permissão',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('hr_permissions')
        .select('permission_type')
        .eq('user_id', userId);

      if (error) throw error;
      return data?.map(p => p.permission_type) || [];
    } catch (error: any) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  };

  return {
    loading,
    permissions,
    fetchPermissions: invalidate,
    grantPermission,
    revokePermission,
    getUserPermissions,
  };
}

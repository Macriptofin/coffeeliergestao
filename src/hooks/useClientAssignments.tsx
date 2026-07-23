import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClientAssignment {
  id: string;
  client_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
  clients?: {
    name: string;
  };
  user_email?: string;
}

const EMPTY_ASSIGNMENTS: ClientAssignment[] = [];
const CLIENT_ASSIGNMENTS_QUERY_KEY = ['client-assignments'] as const;

async function fetchClientAssignments(): Promise<ClientAssignment[]> {
  const { data, error } = await supabase
    .from('client_assignments')
    .select('*, clients(name)')
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Buscar emails dos usuários separadamente
  const userIds = data.map(a => a.user_id);
  const { data: profilesData } = await supabase
    .from('user_profiles')
    .select('user_id, email')
    .in('user_id', userIds);

  const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.email]));
  return data.map(assignment => ({
    ...assignment,
    user_email: profilesMap.get(assignment.user_id) || 'Unknown',
  }));
}

export function useClientAssignments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = EMPTY_ASSIGNMENTS, isPending: loading } = useQuery({
    queryKey: CLIENT_ASSIGNMENTS_QUERY_KEY,
    queryFn: fetchClientAssignments,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CLIENT_ASSIGNMENTS_QUERY_KEY });

  const assignClient = async (clientId: string, userId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('client_assignments')
        .insert({
          client_id: clientId,
          user_id: userId,
          notes,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: 'Cliente atribuído com sucesso',
        description: 'O gerente agora tem acesso a este cliente.',
      });

      invalidate();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: 'Erro ao atribuir cliente',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const unassignClient = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: 'Atribuição removida',
        description: 'O gerente não tem mais acesso a este cliente.',
      });

      invalidate();
    } catch (error: any) {
      console.error('Error unassigning client:', error);
      toast({
        title: 'Erro ao remover atribuição',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getAssignedUsers = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('user_id')
        .eq('client_id', clientId);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('user_id, email')
          .in('user_id', userIds);

        return profilesData || [];
      }

      return [];
    } catch (error: any) {
      console.error('Error fetching assigned users:', error);
      return [];
    }
  };

  return {
    loading,
    assignments,
    fetchAssignments: invalidate,
    assignClient,
    unassignClient,
    getAssignedUsers,
  };
}

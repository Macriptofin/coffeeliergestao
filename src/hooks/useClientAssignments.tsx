import { useState } from 'react';
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

export function useClientAssignments() {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
  const { toast } = useToast();

  const fetchAssignments = async (clientId?: string) => {
    try {
      setLoading(true);
      let query = supabase
        .from('client_assignments')
        .select('*, clients(name)')
        .order('assigned_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Buscar emails dos usuários separadamente
      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.email]));
        const enrichedData = data.map(assignment => ({
          ...assignment,
          user_email: profilesMap.get(assignment.user_id) || 'Unknown',
        }));
        setAssignments(enrichedData);
      } else {
        setAssignments(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching client assignments:', error);
      toast({
        title: 'Erro ao carregar atribuições',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const assignClient = async (clientId: string, userId: string, notes?: string) => {
    try {
      setLoading(true);
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

      await fetchAssignments();
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast({
        title: 'Erro ao atribuir cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const unassignClient = async (assignmentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: 'Atribuição removida',
        description: 'O gerente não tem mais acesso a este cliente.',
      });

      await fetchAssignments();
    } catch (error: any) {
      console.error('Error unassigning client:', error);
      toast({
        title: 'Erro ao remover atribuição',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
    fetchAssignments,
    assignClient,
    unassignClient,
    getAssignedUsers,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSecureAuth } from '@/hooks/useSecureAuth';

export interface PortalClient {
  clientId: string;
  clientName: string;
  portalRole: 'solicitante' | 'aprovador';
  isActive: boolean;
}

// Identidade do usuário-cliente no portal: vincula o login (auth.users) ao client_id.
// Retorna null se o usuário logado NÃO é um cliente de portal (ex.: usuário interno).
export function usePortalClient() {
  const { user, loading: authLoading } = useSecureAuth();

  const query = useQuery({
    queryKey: ['portal-client', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PortalClient | null> => {
      const { data, error } = await supabase
        .from('client_users')
        .select('client_id, portal_role, is_active, clients!inner(name)')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        clientId: data.client_id,
        clientName: (data as any).clients?.name ?? 'Minha empresa',
        portalRole: data.portal_role as PortalClient['portalRole'],
        isActive: data.is_active,
      };
    },
  });

  return {
    portalClient: query.data ?? null,
    isPortalClient: !!query.data,
    loading: authLoading || (!!user?.id && query.isPending),
    user,
  };
}

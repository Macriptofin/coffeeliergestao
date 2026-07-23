import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OperationalAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  module: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  reference_type?: string;
  reference_id?: string;
}

const EMPTY_ALERTS: OperationalAlert[] = [];

async function fetchOperationalAlerts(): Promise<OperationalAlert[]> {
  const { data, error } = await supabase
    .from('operational_alerts')
    .select('*')
    .eq('is_read', false)
    .eq('auto_resolved', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as OperationalAlert[];
}

export function useOperationalAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = EMPTY_ALERTS, isPending: loading } = useQuery({
    queryKey: ['operational-alerts'],
    queryFn: fetchOperationalAlerts,
  });

  useEffect(() => {
    const channel = supabase
      .channel('operational_alerts_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'operational_alerts',
      }, () => queryClient.invalidateQueries({ queryKey: ['operational-alerts'] }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const counts = useMemo(() => ({
    total:    alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
  }), [alerts]);

  const markRead = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.rpc('mark_alert_read', {
      p_alert_id: id,
      p_user_id:  session?.user?.id ?? null,
    });
    queryClient.invalidateQueries({ queryKey: ['operational-alerts'] });
  };

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    await supabase
      .from('operational_alerts')
      .update({ is_read: true, read_by: uid, read_at: new Date().toISOString() })
      .eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['operational-alerts'] });
  };

  return {
    alerts,
    counts,
    loading,
    markRead,
    markAllRead,
    reload: () => queryClient.invalidateQueries({ queryKey: ['operational-alerts'] }),
  };
}

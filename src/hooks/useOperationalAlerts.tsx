import { useState, useEffect, useCallback } from 'react';
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

export function useOperationalAlerts() {
  const [alerts,  setAlerts]  = useState<OperationalAlert[]>([]);
  const [counts,  setCounts]  = useState({ total: 0, critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('operational_alerts')
        .select('*')
        .eq('is_read', false)
        .eq('auto_resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);

      const list = (data || []) as OperationalAlert[];
      setAlerts(list);
      setCounts({
        total:    list.length,
        critical: list.filter(a => a.severity === 'critical').length,
        warning:  list.filter(a => a.severity === 'warning').length,
      });
    } catch (e) {
      console.error('useOperationalAlerts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Realtime subscription
    const channel = supabase
      .channel('operational_alerts_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'operational_alerts',
      }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const markRead = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.rpc('mark_alert_read', {
      p_alert_id: id,
      p_user_id:  session?.user?.id ?? null,
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
    setCounts(prev => ({ ...prev, total: prev.total - 1 }));
  };

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    await supabase
      .from('operational_alerts')
      .update({ is_read: true, read_by: uid, read_at: new Date().toISOString() })
      .eq('is_read', false);
    setAlerts([]);
    setCounts({ total: 0, critical: 0, warning: 0 });
  };

  return { alerts, counts, loading, markRead, markAllRead, reload: load };
}

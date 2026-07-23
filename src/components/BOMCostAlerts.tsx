import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BOMCostAlert {
  id: string;
  bom_type: 'recipe' | 'composite';
  bom_id: string;
  alert_type: 'significant_increase' | 'significant_decrease' | 'threshold_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  old_cost: number;
  new_cost: number;
  change_percent: number;
  threshold_percent: number;
  message: string;
  triggered_by_material_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const EMPTY_ALERTS: BOMCostAlert[] = [];

async function fetchBomCostAlerts(showOnlyUnread: boolean): Promise<BOMCostAlert[]> {
  let query = supabase
    .from('bom_cost_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (showOnlyUnread) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BOMCostAlert[];
}

export function BOMCostAlerts() {
  const queryClient = useQueryClient();
  const [showOnlyUnread, setShowOnlyUnread] = useState(true);
  const { toast } = useToast();

  const { data: alerts = EMPTY_ALERTS, isPending: loading, isError } = useQuery({
    queryKey: ['bom-cost-alerts', showOnlyUnread],
    queryFn: () => fetchBomCostAlerts(showOnlyUnread),
  });

  useEffect(() => {
    if (isError) {
      toast({
        title: "Erro ao carregar alertas",
        description: "Não foi possível carregar os alertas de custo",
        variant: "destructive",
      });
    }
  }, [isError, toast]);

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase.rpc('mark_bom_cost_alert_as_read', {
        p_alert_id: alertId
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['bom-cost-alerts'] });

      toast({
        title: "Alerta marcado como lido",
        description: "O alerta foi marcado como lido com sucesso",
      });
    } catch (error) {
      console.error('Erro ao marcar alerta como lido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar o alerta como lido",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'Crítico';
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Médio';
      case 'low':
        return 'Baixo';
      default:
        return severity;
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (loading) {
    return <div className="text-muted-foreground">Carregando alertas...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {showOnlyUnread 
            ? "Nenhum alerta pendente" 
            : "Nenhum alerta de variação de custo"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Alertas de Variação de Custo</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} novos</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOnlyUnread(!showOnlyUnread)}
        >
          {showOnlyUnread ? 'Mostrar Todos' : 'Apenas Não Lidos'}
        </Button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <Alert 
            key={alert.id} 
            variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'default'}
            className={alert.is_read ? 'opacity-60' : ''}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {alert.alert_type === 'significant_increase' ? (
                  <TrendingUp className="h-5 w-5 mt-0.5 text-destructive" />
                ) : (
                  <TrendingDown className="h-5 w-5 mt-0.5 text-primary" />
                )}
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTitle className="mb-0">
                      {alert.bom_type === 'recipe' ? 'Receita' : 'Composto'}
                    </AlertTitle>
                    <Badge variant={getSeverityColor(alert.severity)}>
                      {getSeverityLabel(alert.severity)}
                    </Badge>
                    {alert.is_read && (
                      <Badge variant="outline" className="text-xs">
                        Lido
                      </Badge>
                    )}
                  </div>
                  
                  <AlertDescription className="space-y-1">
                    <p>{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </AlertDescription>
                </div>
              </div>

              {!alert.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(alert.id)}
                  className="shrink-0"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Marcar como lido
                </Button>
              )}
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}

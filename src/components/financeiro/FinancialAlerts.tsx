import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, AlertCircle, Info, Check, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialAlert {
  id: string;
  alert_type: string;
  reference_type: string;
  reference_id: string;
  title: string;
  message: string;
  severity: string;
  due_date: string | null;
  is_read: boolean;
  created_at: string;
}

interface FinancialAlertsProps {
  showAll?: boolean;
  maxItems?: number;
}

export const FinancialAlerts = ({ showAll = false, maxItems = 5 }: FinancialAlertsProps) => {
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    generateAlerts();
  }, []);

  const generateAlerts = async () => {
    try {
      await supabase.rpc('generate_due_date_alerts');
    } catch (error) {
      console.error('Error generating alerts:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('financial_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!showAll) {
        query = query.eq('is_read', false);
      }

      if (maxItems && !showAll) {
        query = query.limit(maxItems);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('financial_alerts')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      
      setAlerts(alerts.map(a => 
        a.id === id ? { ...a, is_read: true } : a
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
      toast.error('Erro ao marcar alerta como lido');
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('financial_alerts')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('is_read', false);

      if (error) throw error;
      
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      toast.success('Todos os alertas foram marcados como lidos');
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      toast.error('Erro ao marcar alertas como lidos');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Atenção</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Alertas Financeiros</CardTitle>
            <CardDescription>
              {unreadCount > 0 
                ? `${unreadCount} alerta${unreadCount > 1 ? 's' : ''} não lido${unreadCount > 1 ? 's' : ''}`
                : 'Nenhum alerta pendente'}
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={fetchAlerts}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              Marcar todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Carregando alertas...
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mb-2 opacity-50" />
            <p>Nenhum alerta no momento</p>
          </div>
        ) : (
          <ScrollArea className={showAll ? "h-[400px]" : "h-auto"}>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    alert.is_read 
                      ? 'bg-muted/30 border-muted' 
                      : 'bg-background border-border hover:bg-muted/50'
                  }`}
                >
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{alert.title}</span>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {alert.due_date && (
                        <span className="text-orange-600">
                          • Vence em {format(new Date(alert.due_date), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  {!alert.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => markAsRead(alert.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
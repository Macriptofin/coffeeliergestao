import { useState } from 'react';
import { useOperationalAlerts } from '@/hooks/useOperationalAlerts';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, X, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MODULE_ROUTES: Record<string, string> = {
  materiais:  '/materiais/controle',
  vendas:     '/vendas',
  compras:    '/compras',
  producao:   '/producao/planejamento',
  financeiro: '/financeiro',
};

const SEVERITY_ICON = {
  critical: <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
  warning:  <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />,
  info:     <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />,
};

const SEVERITY_BG = {
  critical: 'border-l-2 border-l-red-400 bg-red-50',
  warning:  'border-l-2 border-l-orange-400 bg-orange-50',
  info:     'border-l-2 border-l-blue-400 bg-blue-50',
};

export function NotificationBell() {
  const { alerts, counts, markRead, markAllRead } = useOperationalAlerts();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (alert: typeof alerts[0]) => {
    markRead(alert.id);
    // Solicitação de alteração do portal: cai direto na aba certa (Vendas →
    // Portal → Solicitações), não na aba padrão de Vendas.
    const route = alert.reference_type === 'proposal_change_request'
      ? '/vendas#portal'
      : MODULE_ROUTES[alert.module];
    if (route) { navigate(route); setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-primary-foreground hover:bg-primary-foreground/10"
        >
          <Bell className="h-5 w-5" />
          {counts.total > 0 && (
            <span className={`
              absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold
              flex items-center justify-center px-1
              ${counts.critical > 0 ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}
            `}>
              {counts.total > 99 ? '99+' : counts.total}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-semibold text-sm">Alertas</h3>
            {counts.total > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {counts.critical > 0 && <span className="text-red-600">{counts.critical} crítico(s) · </span>}
                {counts.warning > 0 && <span className="text-orange-600">{counts.warning} atenção</span>}
              </p>
            )}
          </div>
          {counts.total > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todos
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum alerta pendente</p>
            </div>
          ) : (
            <div className="divide-y">
              {alerts.slice(0, 20).map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${SEVERITY_BG[alert.severity]}`}
                  onClick={() => handleClick(alert)}
                >
                  {SEVERITY_ICON[alert.severity]}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{alert.title}</p>
                    {alert.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); markRead(alert.id); }}
                    className="text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {alerts.length > 20 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center">
            +{alerts.length - 20} alertas adicionais
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

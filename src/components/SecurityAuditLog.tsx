import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

interface SecurityAuditEntry {
  id: string;
  user_id: string;
  action: string;
  target_user_id: string;
  old_role?: string;
  new_role?: string;
  created_at: string;
}

export const SecurityAuditLog = () => {
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useUserRole();

  useEffect(() => {
    if (userRole === 'admin') {
      loadAuditLogs();
    } else {
      setLoading(false);
    }
  }, [userRole]);

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao carregar logs de auditoria:', error);
        return;
      }

      setAuditLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs de auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'ROLE_ASSIGNED':
        return 'default';
      case 'ROLE_UPDATED':
        return 'secondary';
      case 'ROLE_REMOVED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'ROLE_ASSIGNED':
        return 'Role Atribuído';
      case 'ROLE_UPDATED':
        return 'Role Atualizado';
      case 'ROLE_REMOVED':
        return 'Role Removido';
      default:
        return action;
    }
  };

  if (userRole !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Log de Auditoria de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Log de Auditoria de Segurança
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Este log registra automaticamente todas as alterações de roles de usuários para fins de auditoria de segurança.
          </AlertDescription>
        </Alert>
        
        {auditLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma atividade de auditoria registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={getActionBadgeVariant(entry.action)}>
                    {getActionLabel(entry.action)}
                  </Badge>
                  <div className="text-sm">
                    <p className="font-medium">
                      Usuário: {entry.target_user_id.slice(0, 8)}...
                    </p>
                    {entry.old_role && entry.new_role ? (
                      <p className="text-muted-foreground">
                        {entry.old_role} → {entry.new_role}
                      </p>
                    ) : entry.new_role ? (
                      <p className="text-muted-foreground">
                        Role: {entry.new_role}
                      </p>
                    ) : entry.old_role ? (
                      <p className="text-muted-foreground">
                        Role removido: {entry.old_role}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
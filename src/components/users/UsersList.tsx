import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Edit, Trash2, Mail, KeyRound, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface UserWithProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  created_at: string;
  email_confirmed?: boolean;
  roles: Array<{
    id: string;
    role: 'admin' | 'manager' | 'financial' | 'user';
    created_at: string;
  }>;
}

interface UsersListProps {
  onEditUser: (user: UserWithProfile) => void;
}

export function UsersList({ onEditUser }: UsersListProps) {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkCurrentUserRole();
    loadUsers();
  }, []);

  const checkCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao verificar role:', error);
        return;
      }

      setCurrentUserRole(data?.role || null);
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Buscar todos os perfis de usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      // Buscar todas as roles
      const userIds = profiles.map(p => p.user_id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      // Criar lista de usuários com suas roles
      const usersWithData: UserWithProfile[] = profiles.map(profile => {
        const userRoles = rolesData?.filter(r => r.user_id === profile.user_id) || [];
        const isEmailConfirmed = profile.email_confirmed_at !== null;

        return {
          id: profile.user_id,
          email: profile.email || `user-${profile.user_id.slice(0, 8)}@system.local`,
          full_name: profile.full_name,
          display_name: profile.display_name,
          created_at: profile.created_at || new Date().toISOString(),
          roles: userRoles,
          email_confirmed: isEmailConfirmed
        };
      });

      setUsers(usersWithData);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === userId) {
        toast.error('Você não pode deletar seu próprio usuário.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Falha ao excluir usuário');
      }

      toast.success('Usuário removido completamente');
      await loadUsers();
    } catch (error: any) {
      console.error('Erro ao remover usuário:', error);
      toast.error(error?.message || 'Erro ao remover usuário');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'financial': return 'secondary';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  const getUserDisplayName = (user: UserWithProfile) => {
    return user.display_name || user.full_name || user.email.split('@')[0];
  };

  const sendPasswordReset = async (userEmail: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.functions.invoke('password-reset', {
        body: {
          email: userEmail,
          redirectTo: `${window.location.origin}/auth`
        }
      });

      if (error) {
        toast.error(`Erro ao enviar email: ${error.message}`);
      } else {
        toast.success(`Email de redefinição de senha enviado para ${userEmail}`);
      }
    } catch (error) {
      console.error('Erro ao enviar reset de senha:', error);
      toast.error('Erro ao enviar email de redefinição');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailVerification = async (userEmail: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail
      });

      if (error) {
        toast.error(`Erro ao reenviar verificação: ${error.message}`);
      } else {
        toast.success(`Email de verificação reenviado para ${userEmail}`);
      }
    } catch (error) {
      console.error('Erro ao reenviar verificação:', error);
      toast.error('Erro ao reenviar email de verificação');
    } finally {
      setLoading(false);
    }
  };

  if (currentUserRole !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Usuários
          </CardTitle>
          <CardDescription>
            Acesso restrito a administradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Você precisa ser um administrador para acessar esta funcionalidade.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista de Usuários
        </CardTitle>
        <CardDescription>
          Gerencie todos os usuários do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <div>
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{getUserDisplayName(user)}</p>
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email_confirmed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {!user.email_confirmed && (
                          <Badge variant="outline" className="text-xs">
                            Não verificado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Criado em: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map(role => (
                          <Badge key={role.id} variant={getRoleBadgeVariant(role.role)}>
                            {role.role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">Sem permissões</Badge>
                      )}
                    </div>
                  </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditUser(user)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendPasswordReset(user.email)}
                      className="flex items-center gap-1"
                      disabled={loading}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset Senha
                    </Button>
                    {!user.email_confirmed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendEmailVerification(user.email)}
                        className="flex items-center gap-1"
                        disabled={loading}
                      >
                        <Mail className="h-4 w-4" />
                        Reenviar
                      </Button>
                    )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover o usuário "{getUserDisplayName(user)}"? 
                          Esta ação não pode ser desfeita e todos os dados e permissões serão perdidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUser(user.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
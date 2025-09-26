import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, UserPlus } from "lucide-react";
import { UsersList } from "./users/UsersList";
import { UserEditor } from "./users/UserEditor";

interface UserWithProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  created_at: string;
  roles: Array<{
    id: string;
    role: 'admin' | 'manager' | 'financial' | 'user';
    created_at: string;
  }>;
}

export function UserRoleManager() {
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'financial' | 'user'>('user');
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    checkCurrentUserRole();
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

  const refreshUsersList = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const createNewUser = async () => {
    console.log('createNewUser chamado com:', { newUserEmail, newUserPassword: '***', newUserRole });
    
    if (!newUserEmail || !newUserPassword || !newUserRole) {
      toast.error('Por favor, preencha todos os campos.');
      return;
    }

    // Validate password strength
    if (newUserPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      toast.error('Por favor, insira um email válido.');
      return;
    }

    if (currentUserRole !== 'admin') {
      toast.error('Apenas administradores podem criar usuários.');
      return;
    }

    try {
      setLoading(true);
      console.log('Tentando criar usuário...');
      
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });

      console.log('Resultado signUp:', { data, error });

      if (error) {
        console.error('Erro ao criar usuário:', error);
        if (error.message?.includes('User already registered')) {
          toast.error('Este email já está cadastrado no sistema');
        } else {
          toast.error(`Erro ao criar usuário: ${error.message}`);
        }
        return;
      }

      if (data.user) {
        console.log('Usuário criado, adicionando role...');
        
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.user.id,
            role: newUserRole
          });

        if (roleError) {
          console.error('Erro ao criar role do usuário:', roleError);
          toast.error('Usuário criado, mas erro ao definir role. Tente definir manualmente.');
        } else {
          toast.success(`Usuário criado com sucesso com o role ${newUserRole}!`);
        }

        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('user');
        refreshUsersList();
      }
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro inesperado ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: UserWithProfile) => {
    setEditingUser(user);
  };

  const handleCloseEditor = () => {
    setEditingUser(null);
    refreshUsersList();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'user': return 'secondary';
      default: return 'outline';
    }
  };

  // Se estiver editando um usuário, mostrar o editor
  if (editingUser) {
    return (
      <UserEditor
        user={editingUser}
        onClose={handleCloseEditor}
        onUserUpdated={refreshUsersList}
      />
    );
  }

  // Apenas admins podem ver e gerenciar roles
  if (currentUserRole !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Acesso restrito a administradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Você precisa ser um administrador para acessar esta funcionalidade.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Novo Usuário
          </CardTitle>
          <CardDescription>
            Cadastre novos usuários diretamente no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="newUserEmail">Email</Label>
              <Input
                id="newUserEmail"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="newUserPassword">Senha</Label>
              <Input
                id="newUserPassword"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mínimo 8 caracteres
              </p>
            </div>
            <div>
              <Label htmlFor="newUserRole">Role</Label>
              <Select value={newUserRole} onValueChange={(value: 'admin' | 'manager' | 'financial' | 'user') => setNewUserRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Acesso total</SelectItem>
                  <SelectItem value="manager">Manager - Gestão operacional</SelectItem>
                  <SelectItem value="financial">Financial - Gestão financeira</SelectItem>
                  <SelectItem value="user">User - Acesso básico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={createNewUser} disabled={loading} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <UsersList key={refreshTrigger} onEditUser={handleEditUser} />
    </div>
  );
}
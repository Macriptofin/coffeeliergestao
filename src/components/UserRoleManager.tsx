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

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'user';
  created_at: string;
}

interface User {
  id: string;
  email: string;
}

export function UserRoleManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [userEmail, setUserEmail] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkCurrentUserRole();
    loadUserRoles();
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

  const loadUserRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error('Erro ao carregar roles:', error);
      toast.error('Erro ao carregar roles dos usuários');
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async () => {
    if (!selectedRole || !userEmail) {
      toast.error('Preencha o ID do usuário e selecione um role');
      return;
    }

    try {
      setLoading(true);
      
      // Verificar se o usuário já tem esse role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userEmail) // userEmail now contains the user ID
        .eq('role', selectedRole)
        .single();

      if (existingRole) {
        toast.error('Usuário já possui esse role');
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userEmail, // userEmail now contains the user ID
          role: selectedRole
        });

      if (error) throw error;

      toast.success(`Role ${selectedRole} atribuído com sucesso`);
      setSelectedUserId('');
      setSelectedRole('user');
      setUserEmail('');
      loadUserRoles();
    } catch (error) {
      console.error('Erro ao atribuir role:', error);
      toast.error('Erro ao atribuir role. Verifique se o ID do usuário está correto.');
    } finally {
      setLoading(false);
    }
  };

  const createNewUser = async () => {
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
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

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
        // Wait a moment for user creation to complete, then assign role
        await new Promise(resolve => setTimeout(resolve, 1500));
        
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
        await loadUserRoles();
      }
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro inesperado ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const removeRole = async (roleId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success('Role removido com sucesso');
      loadUserRoles();
    } catch (error) {
      console.error('Erro ao remover role:', error);
      toast.error('Erro ao remover role');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'user': return 'secondary';
      default: return 'outline';
    }
  };

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
              <Select value={newUserRole} onValueChange={(value: 'admin' | 'manager' | 'user') => setNewUserRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Acesso total</SelectItem>
                  <SelectItem value="manager">Manager - Gestão operacional</SelectItem>
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

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <UserPlus className="h-5 w-5" />
            Cadastro Público
          </CardTitle>
          <CardDescription className="text-blue-700">
            Link para usuários se cadastrarem sozinhos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-blue-700">
              Compartilhe este link para que pessoas possam se cadastrar diretamente:
            </p>
            <code className="bg-white px-3 py-2 rounded border block text-sm break-all">
              {window.location.origin}/auth
            </code>
            <p className="text-xs text-blue-600">
              Novos cadastros automáticamente recebem role "user"
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Gerenciar Roles de Usuários
          </CardTitle>
          <CardDescription>
            Altere permissões de usuários existentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="userEmail">ID do Usuário</Label>
              <Input
                id="userEmail"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="UUID do usuário"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use o ID UUID do usuário da tabela auth.users
              </p>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(value: 'admin' | 'manager' | 'user') => setSelectedRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Acesso total</SelectItem>
                  <SelectItem value="manager">Manager - Gestão operacional</SelectItem>
                  <SelectItem value="user">User - Acesso básico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={assignRole} disabled={loading} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir Role
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários e Roles
          </CardTitle>
          <CardDescription>
            Lista de todos os usuários e suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : userRoles.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum role atribuído</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userRoles.map(userRole => (
                <div key={userRole.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">Usuário ID: {userRole.user_id.slice(0, 8)}...</p>
                      <p className="text-sm text-muted-foreground">
                        Criado em: {new Date(userRole.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={getRoleBadgeVariant(userRole.role)}>
                      {userRole.role}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRole(userRole.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
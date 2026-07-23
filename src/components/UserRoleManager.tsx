import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, UserPlus } from "lucide-react";
import { UsersList } from "./users/UsersList";
import { UserEditor } from "./users/UserEditor";
import { UserForm } from "./users/UserForm";

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

export function UserRoleManager() {
  const { userRole: currentUserRole } = useUserRole();
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshUsersList = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCreateUser = () => {
    setShowUserForm(true);
  };

  const handleUserFormSuccess = () => {
    setShowUserForm(false);
    refreshUsersList();
  };

  const handleUserFormCancel = () => {
    setShowUserForm(false);
  };

  const handleEditUser = (user: UserWithProfile) => {
    setEditingUser(user);
  };

  const handleCloseEditor = () => {
    setEditingUser(null);
    refreshUsersList();
  };

  // Se estiver criando um usuário, mostrar o formulário
  if (showUserForm) {
    return (
      <UserForm
        onSuccess={handleUserFormSuccess}
        onCancel={handleUserFormCancel}
      />
    );
  }

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciamento de Usuários
              </CardTitle>
              <CardDescription>
                Gerencie usuários, permissões e acesso ao sistema
              </CardDescription>
            </div>
            <Button onClick={handleCreateUser} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Criar Novo Usuário
            </Button>
          </div>
        </CardHeader>
      </Card>

      <UsersList key={refreshTrigger} onEditUser={handleEditUser} />
    </div>
  );
}
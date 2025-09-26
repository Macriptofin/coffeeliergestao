import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserX, Save, ArrowLeft, User, Shield } from "lucide-react";
import { PermissionsSelector } from "./PermissionsSelector";

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

interface UserEditorProps {
  user: UserWithProfile;
  onClose: () => void;
  onUserUpdated: () => void;
}

export function UserEditor({ user, onClose, onUserUpdated }: UserEditorProps) {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: user.full_name || '',
    display_name: user.display_name || ''
  });
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'financial' | 'user'>(
    user.roles[0]?.role || 'user'
  );

  const saveProfile = async () => {
    try {
      setLoading(true);

      // Salvar ou atualizar perfil
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: profileData.full_name || null,
          display_name: profileData.display_name || null,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      toast.success('Perfil atualizado com sucesso!');
      onUserUpdated();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async () => {
    try {
      setLoading(true);

      // Remover roles existentes
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      // Adicionar novo role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: selectedRole
        });

      if (roleError) throw roleError;

      toast.success('Role atualizado com sucesso!');
      onUserUpdated();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast.error('Erro ao atualizar role');
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

  const getUserDisplayName = () => {
    return profileData.display_name || profileData.full_name || user.email;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Editar Usuário
                </CardTitle>
                <CardDescription>
                  {getUserDisplayName()} • {user.email}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.roles.map(role => (
                <Badge key={role.id} variant={getRoleBadgeVariant(role.role)}>
                  {role.role}
                </Badge>
              ))}
              {user.roles.length === 0 && (
                <Badge variant="outline">Sem role</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="role">Role do Sistema</TabsTrigger>
          <TabsTrigger value="permissions">Permissões Detalhadas</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Configure as informações básicas do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O email não pode ser alterado
                  </p>
                </div>
                <div>
                  <Label htmlFor="userId">ID do Usuário</Label>
                  <Input
                    id="userId"
                    value={user.id}
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Nome completo do usuário"
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Nome de Exibição</Label>
                  <Input
                    id="displayName"
                    value={profileData.display_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Nome que aparece no sistema"
                  />
                </div>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                <p><strong>Criado em:</strong> {new Date(user.created_at).toLocaleString('pt-BR')}</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="role">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role do Sistema
              </CardTitle>
              <CardDescription>
                Configure o nível de acesso principal do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="userRole">Role Principal</Label>
                <Select value={selectedRole} onValueChange={(value: 'admin' | 'manager' | 'financial' | 'user') => setSelectedRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Acesso total ao sistema</SelectItem>
                    <SelectItem value="manager">Manager - Gestão operacional</SelectItem>
                    <SelectItem value="financial">Financial - Gestão financeira</SelectItem>
                    <SelectItem value="user">User - Acesso básico</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  O role define o nível de acesso geral. Use as permissões detalhadas para controle específico.
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Descrição dos Roles:</h4>
                <div className="text-sm space-y-1">
                  <p><Badge variant="destructive" className="mr-2">Admin</Badge>Acesso completo a todas as funcionalidades</p>
                  <p><Badge variant="default" className="mr-2">Manager</Badge>Gestão operacional e administrativa</p>
                  <p><Badge variant="secondary" className="mr-2">Financial</Badge>Acesso focado em funcionalidades financeiras</p>
                  <p><Badge variant="outline" className="mr-2">User</Badge>Acesso básico conforme permissões específicas</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={updateUserRole} disabled={loading}>
                  <Shield className="h-4 w-4 mr-2" />
                  Atualizar Role
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionsSelector userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
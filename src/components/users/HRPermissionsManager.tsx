import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useHRPermissions, type HRPermissionType } from '@/hooks/useHRPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
}

const permissionLabels: Record<HRPermissionType, { label: string; description: string }> = {
  view_basic_info: {
    label: 'Informações Básicas',
    description: 'Ver nome, cargo, departamento',
  },
  view_personal_documents: {
    label: 'Documentos Pessoais',
    description: 'Ver CPF, RG, endereços',
  },
  view_financial_info: {
    label: 'Informações Financeiras',
    description: 'Ver dados bancários e salários',
  },
  full_access: {
    label: 'Acesso Completo',
    description: 'Criar, editar e deletar funcionários',
  },
};

export function HRPermissionsManager() {
  const { loading, permissions, fetchPermissions, grantPermission, revokePermission } =
    useHRPermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<HRPermissionType>('view_basic_info');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchPermissions();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, email')
      .order('email');

    if (data) {
      const usersData = data.map((u: any) => ({
        id: u.user_id,
        email: u.email,
      }));
      setUsers(usersData);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser || !selectedPermission) return;

    await grantPermission(selectedUser, selectedPermission);
    setSelectedUser('');
    setSelectedPermission('view_basic_info');
    setIsDialogOpen(false);
  };

  const getVariantForPermission = (type: HRPermissionType) => {
    switch (type) {
      case 'full_access':
        return 'destructive';
      case 'view_financial_info':
        return 'default';
      case 'view_personal_documents':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Permissões de RH</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Shield className="mr-2 h-4 w-4" />
              Conceder Permissão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conceder Permissão de RH</DialogTitle>
              <DialogDescription>
                Selecione um usuário e o nível de permissão para dados de RH.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Permissão</Label>
                <Select
                  value={selectedPermission}
                  onValueChange={(value) => setSelectedPermission(value as HRPermissionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(permissionLabels).map(([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGrant} className="w-full" disabled={loading}>
                Conceder Permissão
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading && <p className="text-muted-foreground">Carregando...</p>}

        {!loading && permissions.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            Nenhuma permissão de RH encontrada.
          </Card>
        )}

        {permissions.map((permission) => (
          <Card key={permission.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{permission.user_email}</h4>
                  <Badge variant={getVariantForPermission(permission.permission_type)}>
                    {permissionLabels[permission.permission_type].label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {permissionLabels[permission.permission_type].description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Concedido em{' '}
                  {new Date(permission.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokePermission(permission.id)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

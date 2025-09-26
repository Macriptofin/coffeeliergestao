import { AdminSetup } from "@/components/AdminSetup";
import { UserRoleManager } from "@/components/UserRoleManager";

const UserManagement = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gerenciamento de Usuários</h1>
        <p className="text-muted-foreground">
          Configure permissões e gerencie acesso ao sistema
        </p>
      </div>

      <div className="space-y-6">
        <AdminSetup />
        <UserRoleManager />
      </div>
    </div>
  );
};

export default UserManagement;
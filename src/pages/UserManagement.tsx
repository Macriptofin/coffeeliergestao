import { AdminSetup } from "@/components/AdminSetup";
import { UserRoleManager } from "@/components/UserRoleManager";
import { useUserRole } from "@/hooks/useUserRole";

const UserManagement = () => {
  const { userRole, loading } = useUserRole();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

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
        {userRole === 'admin' && <UserRoleManager />}
      </div>
    </div>
  );
};

export default UserManagement;
import { Navigate, Outlet } from 'react-router-dom';
import { usePortalClient } from '@/hooks/usePortalClient';

// Protege as rotas /portal/*: exige usuário autenticado E vinculado a um cliente.
// Usuários internos (sem vínculo de portal) são mandados de volta ao app.
export function PortalRoute() {
  const { user, isPortalClient, loading } = usePortalClient();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/portal/login" replace />;
  if (!isPortalClient) return <Navigate to="/" replace />;

  return <Outlet />;
}

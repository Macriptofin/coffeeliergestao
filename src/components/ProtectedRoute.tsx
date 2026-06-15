import { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole, UserRole } from '@/hooks/useUserRole';

interface ProtectedRouteProps {
  /** Roles that can access this route. If omitted, any authenticated user passes. */
  requiredRoles: UserRole[];
  /** When used as a wrapper (not a layout route), pass the page as children. */
  children?: ReactNode;
}

const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
    <ShieldOff className="h-14 w-14 text-muted-foreground" />
    <div>
      <h1 className="text-2xl font-bold mb-1">Acesso Negado</h1>
      <p className="text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </p>
    </div>
    <Button variant="outline" onClick={() => history.back()}>
      Voltar
    </Button>
  </div>
);

/**
 * Guards a route by role.
 *
 * Usage as a layout route (guards a group of routes):
 *   <Route element={<ProtectedRoute requiredRoles={['admin']} />}>
 *     <Route path="config" element={<Config />} />
 *   </Route>
 *
 * Usage as a wrapper (guards a single route inline):
 *   <Route path="config" element={<ProtectedRoute requiredRoles={['admin']}><Config /></ProtectedRoute>} />
 */
export const ProtectedRoute = ({ requiredRoles, children }: ProtectedRouteProps) => {
  const { userRole, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const hasAccess = userRole !== null && requiredRoles.includes(userRole);

  if (!hasAccess) {
    return <AccessDenied />;
  }

  // Layout route: render outlet for nested routes
  // Wrapper mode: render children directly
  return children ? <>{children}</> : <Outlet />;
};

import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { CoffeelierLogo } from "@/components/CoffeelierLogo";
import { Sidebar } from "@/components/Sidebar";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { useSessionSecurity } from "@/hooks/useSessionSecurity";
import SecurityHeader from "@/components/security/SecurityHeader";
import SecureErrorBoundary from "@/components/security/SecureErrorBoundary";

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session, loading: authLoading, signOut } = useSecureAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Initialize session security monitoring
  useSessionSecurity();

// Redirect to auth if no session - add a small grace period to avoid race during invite acceptance
const hasRedirected = useRef(false);
const redirectTimer = useRef<number | null>(null);
useEffect(() => {
  // Clear any pending timer when auth state changes
  if (redirectTimer.current) {
    window.clearTimeout(redirectTimer.current);
    redirectTimer.current = null;
  }

  if (!authLoading && !session && !hasRedirected.current) {
    // Wait a short time to allow session to hydrate after setSession on /auth
    redirectTimer.current = window.setTimeout(() => {
      if (!session && !hasRedirected.current) {
        hasRedirected.current = true;
        navigate('/auth', { replace: true });
      }
    }, 700);
  }

  return () => {
    if (redirectTimer.current) {
      window.clearTimeout(redirectTimer.current);
      redirectTimer.current = null;
    }
  };
}, [authLoading, session, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
navigate('/auth', { replace: true });
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

// Show visible fallback while redirecting unauthenticated users
if (!session || !user) {
  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <p className="text-muted-foreground text-sm">Redirecionando para login…</p>
    </div>
  );
}

  return (
    <SecureErrorBoundary>
      <div className="min-h-screen bg-gradient-subtle">
        <SecurityHeader />
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground shadow-warm fixed top-0 left-0 right-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="text-primary-foreground hover:bg-primary-foreground/10 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="flex flex-col">
                <CoffeelierLogo size="lg" className="filter brightness-0 invert" />
                <p className="text-primary-foreground/70 text-xs font-light mt-1 ml-auto">
                  Sistema de Gestão
                </p>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="flex pt-24">
        {/* Desktop Sidebar - positioned in flow to push content */}
        <aside className="hidden md:block w-64 h-[calc(100vh-6rem)] sticky top-24 bg-card border-r">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 bg-card shadow-elegant">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Sidebar onItemClick={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-6rem)] pt-8">
          <div className="container mx-auto px-6 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  </SecureErrorBoundary>
  );
};
import { ReactNode } from 'react';
import { Coffee, LogOut } from 'lucide-react';
import { useSecureAuth } from '@/hooks/useSecureAuth';
import { usePortalClient } from '@/hooks/usePortalClient';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Moldura visual do portal do cliente (identidade Coffeelier — direção "Boutique acolhedor").
export function PortalLayout({ children }: { children: ReactNode }) {
  const { signOut } = useSecureAuth();
  const { portalClient, user } = usePortalClient();
  const initial = (portalClient?.clientName || user?.email || 'C').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background portal-body text-foreground">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-display font-bold text-2xl tracking-tight">
            <Coffee className="h-6 w-6" />
            Coffeelier
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 outline-none">
              <span className="text-sm/none opacity-90 hidden sm:block">
                {portalClient?.clientName}
              </span>
              <span className="w-9 h-9 rounded-full bg-accent-mocca text-accent-mocca-foreground flex items-center justify-center font-semibold">
                {initial}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-10">{children}</main>
    </div>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package,
  ClipboardList,
  Building2, 
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface SidebarProps {
  onItemClick?: () => void;
}

export const Sidebar = ({ onItemClick }: SidebarProps) => {
  const location = useLocation();
  const { isAdminOrManager } = useUserRole();

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      current: location.pathname === "/"
    },
    {
      name: "Estoque",
      href: "/estoque",
      icon: Package,
      current: location.pathname.startsWith("/estoque") || location.pathname === "/ingredientes"
    },
    {
      name: "Compras",
      href: "/compras",
      icon: ShoppingCart,
      current: location.pathname.startsWith("/compras")
    },
    {
      name: "Vendas",
      href: "/vendas",
      icon: TrendingUp,
      current: location.pathname.startsWith("/vendas")
    },
    {
      name: "Agenda",
      href: "/agenda",
      icon: Calendar,
      current: location.pathname.startsWith("/agenda")
    },
    {
      name: "Produção",
      href: "/producao",
      icon: ClipboardList,
      current: location.pathname.startsWith("/producao") || location.pathname === "/receitas"
    },
    {
      name: "Fornecedores",
      href: "/fornecedores",
      icon: Building2,
      current: location.pathname === "/fornecedores"
    },
    {
      name: "Financeiro",
      href: "/financeiro",
      icon: DollarSign,
      current: location.pathname.startsWith("/financeiro")
    },
    {
      name: "Recursos Humanos",
      href: "/rh",
      icon: Users,
      current: location.pathname.startsWith("/rh") || location.pathname === "/usuarios"
    },
    {
      name: "Relatórios",
      href: "/relatorios",
      icon: FileText,
      current: location.pathname === "/relatorios"
    }
  ].filter(item => {
    // Filtrar itens baseado no papel do usuário
    if (item.name === "Recursos Humanos" && !isAdminOrManager()) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-64 bg-card border-r border-border h-full">
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                item.current
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
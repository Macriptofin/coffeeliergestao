import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Plus, 
  ChefHat, 
  Building2, 
  Package,
  FileText, 
  ClipboardList 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onItemClick?: () => void;
}

export const Sidebar = ({ onItemClick }: SidebarProps) => {
  const location = useLocation();

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      current: location.pathname === "/"
    },
    {
      name: "Ingredientes",
      href: "/ingredientes",
      icon: Plus,
      current: location.pathname === "/ingredientes"
    },
    {
      name: "Receitas",
      href: "/receitas",
      icon: ChefHat,
      current: location.pathname === "/receitas"
    },
    {
      name: "Fornecedores",
      href: "/fornecedores",
      icon: Building2,
      current: location.pathname === "/fornecedores"
    },
    {
      name: "Produção",
      href: "/producao",
      icon: ClipboardList,
      current: location.pathname === "/producao"
    },
    {
      name: "Estoque",
      href: "/estoque",
      icon: Package,
      current: location.pathname === "/estoque"
    },
    {
      name: "Relatórios",
      href: "/relatorios",
      icon: FileText,
      current: location.pathname === "/relatorios"
    }
  ];

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
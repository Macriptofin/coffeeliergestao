import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Calendar,
  Settings,
  ChevronDown,
  ChevronRight,
  Boxes,
  ArrowLeftRight,
  BarChart3,
  ClipboardCheck,
  Receipt,
  BookOpen,
  Factory,
  TableProperties,
  UserCog,
  Clock,
  Wallet,
  CreditCard,
  TrendingDown,
  Banknote,
  RefreshCw,
  PieChart,
  Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface SubItem {
  name: string;
  href: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  matchPaths?: string[];
  adminOnly?: boolean;
  children?: SubItem[];
}

interface SidebarProps {
  onItemClick?: () => void;
}

export const Sidebar = ({ onItemClick }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdminOrManager } = useUserRole();

  const isActive = (item: NavItem) => {
    if (item.href === "/") return location.pathname === "/";
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname.startsWith(p) || location.pathname === p);
    }
    return location.pathname.startsWith(item.href);
  };

  const navigation: NavItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Materiais",
      href: "/materiais",
      icon: Package,
      matchPaths: ["/materiais", "/estoque", "/ingredientes"],
      children: [
        { name: "Cadastro", href: "/ingredientes" },
        { name: "Controle de Estoque", href: "/materiais/controle" },
        { name: "Movimentações", href: "/materiais/movimentacoes" },
        { name: "Inventário", href: "/materiais/inventario-ajustes" },
        { name: "Relatórios", href: "/materiais/relatorios" },
      ]
    },
    {
      name: "Compras",
      href: "/compras",
      icon: ShoppingCart,
      children: [
        { name: "Necessidades (MRP)", href: "/compras" },
        { name: "Notas Fiscais", href: "/compras#notas" },
        { name: "Cotações", href: "/compras#cotacoes" },
        { name: "Pedidos", href: "/compras#pedidos" },
        { name: "Fornecedores", href: "/fornecedores" },
      ]
    },
    {
      name: "Vendas",
      href: "/vendas",
      icon: TrendingUp,
      children: [
        { name: "Propostas", href: "/vendas#propostas" },
        { name: "Clientes", href: "/vendas#clientes" },
        { name: "Pedidos", href: "/vendas#pedidos" },
      ]
    },
    {
      name: "Agenda",
      href: "/agenda",
      icon: Calendar,
    },
    {
      name: "Produção",
      href: "/producao",
      icon: ClipboardList,
      matchPaths: ["/producao", "/receitas"],
      children: [
        { name: "Fichas Técnicas", href: "/producao/fichas-tecnicas" },
        { name: "Ordens de Produção", href: "/producao/planejamento" },
        { name: "Mesas / Eventos", href: "/producao/eventos" },
        { name: "Relatórios", href: "/producao/relatorios" },
      ]
    },
    {
      name: "Financeiro",
      href: "/financeiro",
      icon: DollarSign,
      children: [
        { name: "DRE", href: "/financeiro/dre" },
        { name: "Contas a Pagar", href: "/financeiro/pagar" },
        { name: "Contas a Receber", href: "/financeiro/receber" },
        { name: "Fluxo de Caixa", href: "/financeiro/fluxo" },
        { name: "Contas Bancárias", href: "/financeiro/bancos" },
        { name: "Previsão de Caixa", href: "/financeiro/previsao" },
        { name: "Aging de Contas", href: "/financeiro/aging" },
      ]
    },
    {
      name: "Recursos Humanos",
      href: "/rh",
      icon: Users,
      matchPaths: ["/rh", "/usuarios"],
      children: [
        { name: "Colaboradores", href: "/rh/colaboradores" },
        { name: "Usuários do Sistema", href: "/usuarios" },
        { name: "Controle de Ponto", href: "/rh/ponto" },
      ]
    },
    {
      name: "Relatórios",
      href: "/relatorios",
      icon: FileText,
    },
    {
      name: "Configurações",
      href: "/config",
      icon: Settings,
      adminOnly: true,
    }
  ].filter(item => {
    if (item.name === "Recursos Humanos" && !isAdminOrManager()) return false;
    if (item.adminOnly && !isAdminOrManager()) return false;
    return true;
  });

  // Auto-expande o menu do módulo atual
  const getInitialExpanded = () => {
    const expanded: Record<string, boolean> = {};
    navigation.forEach(item => {
      if (item.children && isActive(item)) {
        expanded[item.name] = true;
      }
    });
    return expanded;
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpanded);

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleParentClick = (item: NavItem) => {
    if (item.children) {
      toggleExpand(item.name);
      // Navega para a hub page ao clicar no item pai
      navigate(item.href);
    }
    onItemClick?.();
  };

  return (
    <div className="w-64 bg-card border-r border-border h-full">
      <nav className="px-3 pt-5 pb-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const isExpanded = expanded[item.name];
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.name}>
              {/* Item pai */}
              {hasChildren ? (
                <button
                  onClick={() => handleParentClick(item)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </div>
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                    : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                  }
                </button>
              ) : (
                <NavLink
                  to={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </NavLink>
              )}

              {/* Subitens */}
              {hasChildren && isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                  {item.children!.map(child => {
                    const childActive = location.pathname === child.href ||
                      (child.href.includes('#') && location.pathname === child.href.split('#')[0]);
                    return (
                      <NavLink
                        key={child.href}
                        to={child.href.split('#')[0]}
                        onClick={onItemClick}
                        className={cn(
                          "flex items-center px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                          childActive
                            ? "text-primary bg-primary/10 font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        {child.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

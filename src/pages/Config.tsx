import React, { useState } from 'react';
import {
  Settings, Building2, Package, Wrench, DollarSign,
  Calendar, Users, Palette, ChevronRight, ShoppingCart,
  UserCog, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfigColors } from "@/components/config/ConfigColors";
import { Card } from "@/components/ui/card";
import { ConfigGeneral } from "@/components/config/ConfigGeneral";
import { ConfigDadosEmpresa } from "@/components/config/ConfigDadosEmpresa";
import { ConfigEstoque } from "@/components/config/ConfigEstoque";
import { ConfigProducao } from "@/components/config/ConfigProducao";
import { ConfigVendas } from "@/components/config/ConfigVendas";
import { ConfigFinanceiro } from "@/components/config/ConfigFinanceiro";
import { ConfigEventos } from "@/components/config/ConfigEventos";
import { ConfigRH } from "@/components/config/ConfigRH";
import { ConfigPrecificacao } from "@/components/config/ConfigPrecificacao";
import { useConfig } from "@/hooks/useConfig";
import { UserRoleManager } from "@/components/UserRoleManager";
import { AccessProfilesManager } from "@/components/AccessProfilesManager";

// ─── Navigation structure ────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Empresa',
    items: [
      { id: 'empresa',    label: 'Dados da Empresa', icon: Building2,   description: 'CNPJ, endereço e dados fiscais' },
      { id: 'identidade', label: 'Identidade Visual', icon: Palette,     description: 'Cores e aparência da marca' },
    ],
  },
  {
    label: 'Módulos',
    items: [
      { id: 'estoque',    label: 'Materiais',  icon: Package,      description: 'Categorias, unidades e importação' },
      { id: 'producao',   label: 'Produção',   icon: Wrench,       description: 'Parâmetros de produção' },
      { id: 'vendas',     label: 'Vendas',     icon: ShoppingCart, description: 'Categorias e parâmetros de vendas' },
      { id: 'precificacao', label: 'Precificação', icon: DollarSign, description: 'Margem, overhead e regras por categoria' },
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign,   description: 'Contas e regras financeiras' },
      { id: 'eventos',    label: 'Eventos',    icon: Calendar,     description: 'Configurações de eventos' },
      { id: 'rh',         label: 'RH',         icon: Users,        description: 'Recursos humanos' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'aparencia', label: 'Aparência', icon: Settings, description: 'Tema e configurações gerais' },
      { id: 'usuarios',  label: 'Usuários',  icon: UserCog,  description: 'Cadastro, nível de acesso e perfil de cada usuário' },
      { id: 'perfis-acesso', label: 'Perfis de Acesso', icon: ShieldCheck, description: 'Defina os perfis (Financeiro, Compras, RH...) e suas permissões' },
    ],
  },
];

const VALID_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

// ─── Content renderer ────────────────────────────────────────────────────────

function ConfigContent({ section }: { section: string }) {
  switch (section) {
    case 'empresa':    return <ConfigDadosEmpresa />;
    case 'identidade': return <ConfigColors namespace="empresa" />;
    case 'estoque':    return <ConfigEstoque />;
    case 'producao':   return <ConfigProducao />;
    case 'vendas':     return <ConfigVendas />;
    case 'precificacao': return <ConfigPrecificacao />;
    case 'financeiro': return <ConfigFinanceiro />;
    case 'eventos':    return <ConfigEventos />;
    case 'rh':         return <ConfigRH />;
    case 'aparencia':  return <ConfigGeneral />;
    case 'usuarios':       return <UserRoleManager />;
    case 'perfis-acesso':  return <AccessProfilesManager />;
    default: return null;
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

const Config = () => {
  const { loading } = useConfig();

  const [activeSection, setActiveSection] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return VALID_IDS.includes(hash) ? hash : 'empresa';
  });

  const navigate = (id: string) => {
    setActiveSection(id);
    window.history.replaceState(null, '', `/config#${id}`);
  };

  const activeItem = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie dados da empresa e parâmetros do sistema</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left group',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className={cn(
                        'h-4 w-4 flex-shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'
                      )} />
                      <span className="truncate flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-primary/50" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {/* Breadcrumb */}
          {activeItem && (
            <div className="flex items-center gap-1.5 mb-5 text-sm text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              <span>Configurações</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              <span className="text-foreground font-medium">{activeItem.label}</span>
            </div>
          )}

          <ConfigContent section={activeSection} />
        </main>

      </div>
    </ErrorBoundary>
  );
};

export default Config;

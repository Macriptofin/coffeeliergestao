import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, ClipboardList, Calculator, FileText, Settings, Calendar, Package2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlags, logFeatureFlagEvent } from "@/hooks/useFeatureFlags";

const ProducaoMain = () => {
  const navigate = useNavigate();
  const { flags, loading } = useFeatureFlags();

  // Legacy modules (shown when flags are OFF)
  const legacyModules = [
    {
      title: "Receitas",
      description: "Criação e gestão de receitas com cálculo automático de custos",
      icon: ChefHat,
      href: "/receitas",
      color: "bg-red-500",
      hidden: flags.FF_UNIFY_BOM_RECEITAS
    },
    {
      title: "Ordens de Produção",
      description: "Planejamento e controle da produção diária",
      icon: ClipboardList,
      href: "/producao/ordens",
      color: "bg-blue-500"
    },
    {
      title: "Planejamento",
      description: "Programação de produção e otimização de recursos",
      icon: Settings,
      href: "/producao/planejamento",
      color: "bg-purple-500"
    },
    {
      title: "BOM & Produção",
      description: "Configuração de BOMs e execução de produção/montagem",
      icon: Settings,
      href: "/producao/bom",
      color: "bg-indigo-500",
      hidden: flags.FF_UNIFY_BOM_RECEITAS
    },
    {
      title: "Relatórios de Produção",
      description: "Performance, eficiência e análises de produção e custos",
      icon: FileText,
      href: "/producao/relatorios",
      color: "bg-orange-500"
    },
    {
      title: "Mesas/Eventos",
      description: "Gestão dinâmica de eventos com cálculo automático por pessoa",
      icon: Calendar,
      href: "/producao/eventos",
      color: "bg-pink-500",
      hidden: !flags.FF_EVENT_TABLES_ENABLED
    }
  ];

  // New unified modules (shown when flags are ON)
  const unifiedModules = [
    {
      title: "Fichas Técnicas (BOM)",
      description: "Gestão unificada de produtos, receitas e composições com custos automáticos",
      icon: Package2,
      href: "/producao/fichas-tecnicas",
      color: "bg-emerald-500",
      shown: flags.FF_UNIFY_BOM_RECEITAS
    },
    {
      title: "Ordens de Produção", 
      description: "Centro operacional - produção centralizada com integração de eventos",
      icon: ClipboardList,
      href: "/producao/ordens",
      color: "bg-blue-500"
    },
    {
      title: "Planejamento",
      description: "Programação de produção e otimização de recursos",
      icon: Settings,
      href: "/producao/planejamento",
      color: "bg-purple-500"
    },
    {
      title: "Relatórios",
      description: "Performance, custos completos e análises detalhadas de produção",
      icon: FileText,
      href: "/producao/relatorios",
      color: "bg-orange-500"
    },
    {
      title: "Mesas/Eventos",
      description: "Gestão de eventos com auto-geração de ordens de produção",
      icon: Calendar,
      href: "/producao/eventos",
      color: "bg-pink-500",
      hidden: !flags.FF_EVENT_TABLES_ENABLED
    }
  ];

  const getActiveModules = () => {
    if (flags.FF_UNIFY_BOM_RECEITAS || flags.FF_MOVE_COSTS_TO_REPORTS) {
      return unifiedModules.filter(module => !module.hidden && module.shown !== false);
    }
    return legacyModules.filter(module => !module.hidden);
  };

  const modules = getActiveModules();

  const handleModuleClick = (module: any) => {
    logFeatureFlagEvent('nav.module.click', module.href);
    navigate(module.href);
  };

  // Mostrar loading enquanto os feature flags carregam para evitar "pulo" na interface
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Produção</h1>
          <p className="text-muted-foreground">
            Controle completo da produção unificada: produtos, receitas, custos e execução
          </p>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Produção</h1>
        <p className="text-muted-foreground">
          Controle completo da produção unificada: produtos, receitas, custos e execução
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {module.description}
                </CardDescription>
                <Button 
                  onClick={() => handleModuleClick(module)}
                  variant="outline" 
                  className="w-full"
                >
                  Acessar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProducaoMain;
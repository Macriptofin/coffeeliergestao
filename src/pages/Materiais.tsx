//
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Plus, TrendingUp, BarChart3, FileInput, ClipboardCheck, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Materiais = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Cadastro de Materiais",
      description: "Cadastro e gestão de ingredientes, embalagens e produtos",
      icon: Plus,
      href: "/ingredientes",
      color: "bg-blue-500"
    },
    {
      title: "Controle de Estoque",
      description: "Acompanhe quantidades, movimentações e níveis mínimos",
      icon: Package,
      href: "/materiais/controle",
      color: "bg-green-500"
    },
    {
      title: "Gestão de Estoque",
      description: "Parâmetros ABC, níveis mín/máx e planejamento de compras",
      icon: Settings,
      href: "/materiais/gestao",
      color: "bg-purple-500"
    },
    {
      title: "Movimentações",
      description: "Histórico de entradas, saídas e transferências",
      icon: TrendingUp,
      href: "/materiais/movimentacoes",
      color: "bg-orange-500"
    },
    {
      title: "Relatórios de Estoque",
      description: "Análises, inventários e relatórios de valorização",
      icon: BarChart3,
      href: "/materiais/relatorios",
      color: "bg-purple-500"
    },
    {
      title: "Importação de Dados",
      description: "Importar materiais e dados de estoque via planilha",
      icon: FileInput,
      href: "/materiais/importacao",
      color: "bg-cyan-500"
    },
    {
      title: "Inventário & Ajustes",
      description: "Inventário físico, ajustes de quantidade e custo auditáveis",
      icon: ClipboardCheck,
      href: "/materiais/inventario-ajustes",
      color: "bg-indigo-500"
    },
    {
      title: "Materiais com Problemas",
      description: "Diagnóstico e correção de códigos e categorias inconsistentes",
      icon: Settings,
      href: "/materiais/problemas",
      color: "bg-red-500"
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Materiais</h1>
        <p className="text-muted-foreground">
          Centralize o controle de materiais, estoque, movimentações e relatórios
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
                  onClick={() => navigate(module.href)}
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

export default Materiais;

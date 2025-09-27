import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, ClipboardList, Calculator, FileText, Settings, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProducaoMain = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Receitas",
      description: "Criação e gestão de receitas com cálculo automático de custos",
      icon: ChefHat,
      href: "/receitas",
      color: "bg-red-500"
    },
    {
      title: "Ordens de Produção",
      description: "Planejamento e controle da produção diária",
      icon: ClipboardList,
      href: "/producao/ordens",
      color: "bg-blue-500"
    },
    {
      title: "Cálculo de Custos",
      description: "Análise de custos de produção e precificação",
      icon: Calculator,
      href: "/producao/calculo-custos",
      color: "bg-green-500"
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
      color: "bg-indigo-500"
    },
    {
      title: "Relatórios de Produção",
      description: "Performance, eficiência e análises de produção",
      icon: FileText,
      href: "/producao/relatorios",
      color: "bg-orange-500"
    },
    {
      title: "Mesas/Eventos",
      description: "Gestão dinâmica de eventos com cálculo automático por pessoa",
      icon: Calendar,
      href: "/producao/eventos",
      color: "bg-pink-500"
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Produção</h1>
        <p className="text-muted-foreground">
          Controle completo do processo produtivo, receitas e custos
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

export default ProducaoMain;
import { Card } from "@/components/ui/card";
import { Package, FileText, TrendingUp, BarChart, Settings, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockParameters } from "@/components/stock/StockParameters";
import { StockPlanning } from "@/components/stock/StockPlanning";

const Estoque = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Visão Geral",
      description: "Consulta de saldos e valores em estoque por material",
      icon: Package,
      href: "/estoque/visao-geral",
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "Parâmetros de Estoque",
      description: "Configure classificação ABC e níveis de estoque (mín/máx) por material",
      icon: Settings,
      href: "/estoque/parametros",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Planejamento de Estoque",
      description: "Execute análise ABC e gere necessidades de compra baseadas em estoques mínimos",
      icon: TrendingUp,
      href: "/estoque/planejamento",
      color: "from-green-500 to-emerald-500"
    },
    {
      title: "Movimentações",
      description: "Histórico completo de entradas e saídas de materiais",
      icon: FileText,
      href: "/estoque/movimentacoes",
      color: "from-orange-500 to-red-500"
    },
    {
      title: "Ajustes de Inventário",
      description: "Correções de quantidade e custo no estoque",
      icon: ClipboardCheck,
      href: "/estoque/ajustes",
      color: "from-indigo-500 to-purple-500"
    },
    {
      title: "Relatórios",
      description: "Análises e relatórios de estoque, curva ABC, giro",
      icon: BarChart,
      href: "/estoque/relatorios",
      color: "from-teal-500 to-cyan-500"
    }
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestão de Estoque</h1>
        <p className="text-muted-foreground">
          Controle completo de materiais, movimentações e planejamento de estoque
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="parameters">Parâmetros</TabsTrigger>
          <TabsTrigger value="planning">Planejamento</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="adjustments">Ajustes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <Card
                key={module.title}
                className="group relative overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(module.href)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <div className="relative p-6">
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${module.color} mb-4`}>
                    <module.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overview">
          <Card className="p-6">
            <p className="text-muted-foreground">Módulo de Visão Geral em desenvolvimento</p>
          </Card>
        </TabsContent>

        <TabsContent value="parameters">
          <StockParameters />
        </TabsContent>

        <TabsContent value="planning">
          <StockPlanning />
        </TabsContent>

        <TabsContent value="movements">
          <Card className="p-6">
            <p className="text-muted-foreground">Módulo de Movimentações em desenvolvimento</p>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments">
          <Card className="p-6">
            <p className="text-muted-foreground">Módulo de Ajustes em desenvolvimento</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Estoque;

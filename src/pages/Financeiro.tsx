import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, FileText, TrendingUp, Calculator, PieChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Financeiro = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Contas a Pagar",
      description: "Controle de fornecedores, duplicatas e pagamentos",
      icon: CreditCard,
      href: "/financeiro/pagar",
      color: "bg-red-500"
    },
    {
      title: "Contas a Receber",
      description: "Gestão de vendas, recebimentos e cobrança",
      icon: DollarSign,
      href: "/financeiro/receber",
      color: "bg-green-500"
    },
    {
      title: "Fluxo de Caixa",
      description: "Acompanhamento de entradas e saídas de caixa",
      icon: TrendingUp,
      href: "/financeiro/fluxo",
      color: "bg-blue-500"
    },
    {
      title: "Centros de Custo",
      description: "Organização e controle de custos por departamento",
      icon: Calculator,
      href: "/financeiro/custos",
      color: "bg-purple-500"
    },
    {
      title: "Análises Financeiras",
      description: "Indicadores, gráficos e análises de performance",
      icon: PieChart,
      href: "/financeiro/analises",
      color: "bg-orange-500"
    },
    {
      title: "Relatórios Contábeis",
      description: "DRE, Balanço e relatórios para contabilidade",
      icon: FileText,
      href: "/financeiro/relatorios",
      color: "bg-cyan-500"
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão Financeira</h1>
        <p className="text-muted-foreground">
          Controle completo das finanças, custos e análises contábeis
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

export default Financeiro;
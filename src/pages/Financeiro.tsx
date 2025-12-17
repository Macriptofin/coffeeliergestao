import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, FileText, TrendingUp, Calculator, PieChart, Building2, Repeat, CalendarClock, LineChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FinancialAlerts } from "@/components/financeiro/FinancialAlerts";

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
      title: "Contas Bancárias",
      description: "Cadastro de bancos e controle de saldos",
      icon: Building2,
      href: "/financeiro/bancos",
      color: "bg-indigo-500"
    },
    {
      title: "Transações Recorrentes",
      description: "Lançamentos automáticos periódicos",
      icon: Repeat,
      href: "/financeiro/recorrentes",
      color: "bg-violet-500"
    },
    {
      title: "Previsão de Caixa",
      description: "Projeção de fluxo de caixa futuro",
      icon: LineChart,
      href: "/financeiro/previsao",
      color: "bg-emerald-500"
    },
    {
      title: "Aging de Contas",
      description: "Análise de vencimentos por faixa de tempo",
      icon: CalendarClock,
      href: "/financeiro/aging",
      color: "bg-amber-500"
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
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão Financeira</h1>
        <p className="text-muted-foreground">
          Controle completo das finanças, custos e análises contábeis
        </p>
      </div>

      {/* Alertas Financeiros */}
      <FinancialAlerts maxItems={3} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(module.href)}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs">
                  {module.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Financeiro;
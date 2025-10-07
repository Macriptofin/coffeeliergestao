import { PricingHealthDashboard } from "@/components/stock/PricingHealthDashboard";
import { CostSourceSummary } from "@/components/stock/CostSourceSummary";

const PricingDiagnostics = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Diagnóstico de Precificação</h1>
        <p className="text-muted-foreground">
          Análise de saúde do sistema de preço médio ponderado e conversão de unidades
        </p>
      </div>

      <CostSourceSummary />
      <PricingHealthDashboard />
    </div>
  );
};

export default PricingDiagnostics;

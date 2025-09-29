import { StockPlanning } from "@/components/stock/StockPlanning";

const EstoquePlanejamento = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Planejamento de Estoque</h1>
        <p className="text-muted-foreground">
          Execute análise ABC e gere necessidades de compra baseadas em estoques mínimos
        </p>
      </div>
      
      <StockPlanning />
    </div>
  );
};

export default EstoquePlanejamento;

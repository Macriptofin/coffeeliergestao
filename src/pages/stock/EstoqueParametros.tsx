import { StockParameters } from "@/components/stock/StockParameters";

const EstoqueParametros = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Parâmetros de Estoque</h1>
        <p className="text-muted-foreground">
          Configure classificação ABC e níveis de estoque para cada material
        </p>
      </div>
      
      <StockParameters />
    </div>
  );
};

export default EstoqueParametros;

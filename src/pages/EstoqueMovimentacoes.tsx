import { StockMovements } from "@/components/stock/StockMovements";

const EstoqueMovimentacoes = () => {
  const handleRefresh = () => {
    // Força o reload do componente StockMovements
    window.location.reload();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Movimentações de Estoque</h1>
        <p className="text-muted-foreground">
          Histórico completo de entradas, saídas e ajustes de estoque
        </p>
      </div>
      
      <StockMovements onRefresh={handleRefresh} />
    </div>
  );
};

export default EstoqueMovimentacoes;
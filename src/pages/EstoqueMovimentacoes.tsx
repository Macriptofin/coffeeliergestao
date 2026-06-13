import { HistoricoUnificado } from "@/components/inventory/HistoricoUnificado";

const EstoqueMovimentacoes = () => {
  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Movimentações de Estoque</h1>
        <p className="text-muted-foreground text-sm">
          Histórico completo de entradas, saídas e ajustes de estoque
        </p>
      </div>

      <HistoricoUnificado />
    </div>
  );
};

export default EstoqueMovimentacoes;

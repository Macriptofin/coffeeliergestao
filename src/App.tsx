import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Materials from "./pages/Materials";
import Recipes from "./pages/Recipes";
import Suppliers from "./pages/Suppliers";
import Production from "./pages/Production";
import Stock from "./pages/Stock";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import SecurityMonitoring from "./pages/SecurityMonitoring";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Estoque from "./pages/Estoque";
import ProducaoMain from "./pages/ProducaoMain";
import Financeiro from "./pages/Financeiro";
import ContasPagar from "./pages/financeiro/ContasPagar";
import ContasReceber from "./pages/financeiro/ContasReceber";
import FluxoCaixa from "./pages/financeiro/FluxoCaixa";
import CentrosCusto from "./pages/financeiro/CentrosCusto";
import AnaliseFinanceira from "./pages/financeiro/AnaliseFinanceira";
import RelatoriosContabeis from "./pages/financeiro/RelatoriosContabeis";
import RecursosHumanos from "./pages/RecursosHumanos";
import Colaboradores from "./pages/Colaboradores";
import EstoqueMovimentacoes from "./pages/EstoqueMovimentacoes";
import Agenda from "./pages/Agenda";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster />
        <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              {/* Categoria Estoque */}
              <Route path="estoque" element={<Estoque />} />
              <Route path="ingredientes" element={<Materials />} />
              <Route path="estoque/movimentacoes" element={<EstoqueMovimentacoes />} />
              <Route path="estoque/*" element={<Stock />} />
              {/* Categoria Compras */}
              <Route path="compras" element={<Purchases />} />
              {/* Categoria Vendas */}
              <Route path="vendas" element={<Sales />} />
              {/* Agenda de Eventos */}
              <Route path="agenda" element={<Agenda />} />
              {/* Categoria Produção */}
              <Route path="producao" element={<ProducaoMain />} />
              <Route path="receitas" element={<Recipes />} />
              <Route path="producao/*" element={<Production />} />
              {/* Fornecedores */}
              <Route path="fornecedores" element={<Suppliers />} />
              {/* Categoria Financeiro */}
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="financeiro/pagar" element={<ContasPagar />} />
              <Route path="financeiro/receber" element={<ContasReceber />} />
              <Route path="financeiro/fluxo" element={<FluxoCaixa />} />
              <Route path="financeiro/custos" element={<CentrosCusto />} />
              <Route path="financeiro/analises" element={<AnaliseFinanceira />} />
              <Route path="financeiro/relatorios" element={<RelatoriosContabeis />} />
              {/* Categoria Recursos Humanos */}
              <Route path="rh" element={<RecursosHumanos />} />
              <Route path="rh/colaboradores" element={<Colaboradores />} />
              <Route path="usuarios" element={<UserManagement />} />
              <Route path="seguranca" element={<SecurityMonitoring />} />
              {/* Relatórios */}
              <Route path="relatorios" element={<Reports />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

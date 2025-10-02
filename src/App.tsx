import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { FeatureFlagRedirect } from '@/components/FeatureFlagRedirect';
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
import Materiais from "./pages/Materiais";
import MateriaisGestao from "./pages/stock/MateriaisGestao";
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
import EnhancedSecurity from "./pages/EnhancedSecurity";
import SecurityAnomalies from "./pages/SecurityAnomalies";
import InventarioAjustes from "./pages/InventarioAjustes";
import InventarioCiclo from "./pages/InventarioCiclo";

import CostCalculation from "./pages/production/CostCalculation";
import ProductionPlanning from "./pages/production/ProductionPlanning";
import ProductionReports from "./pages/production/ProductionReportsEnhanced";
import BOMManagement from "./pages/BOMManagement";
import EventTables from "./pages/EventTables";
import FichasTecnicas from "./components/FichasTecnicas";
import { MaterialEdit } from "./pages/MaterialEdit";
import Config from "./pages/Config";
import EstoqueRelatorios from "./pages/stock/EstoqueRelatorios";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeatureFlagRedirect>
          <Toaster />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              
              {/* Categoria Materiais (nova estrutura) */}
              <Route path="materiais" element={<Materiais />} />
              <Route path="materiais/controle" element={<Stock />} />
              <Route path="materiais/gestao" element={<MateriaisGestao />} />
              <Route path="materiais/movimentacoes" element={<EstoqueMovimentacoes />} />
              <Route path="materiais/relatorios" element={<EstoqueRelatorios />} />
              <Route path="materiais/inventario-ajustes" element={<InventarioAjustes />} />
              <Route path="materiais/inventario-ajustes/ciclo/:cycleId" element={<InventarioCiclo />} />
              <Route path="materiais/importacao" element={<Stock />} />
              <Route path="materiais/:id/editar" element={<MaterialEdit />} />
              
              {/* Redirects de rotas antigas para manter bookmarks */}
              <Route path="estoque" element={<Materiais />} />
              <Route path="estoque/controle" element={<Stock />} />
              <Route path="estoque/parametros" element={<MateriaisGestao />} />
              <Route path="estoque/planejamento" element={<MateriaisGestao />} />
              <Route path="estoque/movimentacoes" element={<EstoqueMovimentacoes />} />
              <Route path="estoque/relatorios" element={<EstoqueRelatorios />} />
              <Route path="estoque/inventario-ajustes" element={<InventarioAjustes />} />
              <Route path="estoque/inventario-ajustes/ciclo/:cycleId" element={<InventarioCiclo />} />
              <Route path="estoque/importacao" element={<Stock />} />
              <Route path="estoque/materiais/:id/editar" element={<MaterialEdit />} />
              <Route path="estoque/*" element={<Stock />} />
              
              {/* Cadastro de materiais */}
              <Route path="ingredientes" element={<Materials />} />
              {/* Categoria Compras */}
              <Route path="compras" element={<Purchases />} />
              {/* Categoria Vendas */}
              <Route path="vendas" element={<Sales />} />
              {/* Agenda de Eventos */}
              <Route path="agenda" element={<Agenda />} />
              {/* Categoria Produção */}
              <Route path="producao" element={<ProducaoMain />} />
              <Route path="receitas" element={<Recipes />} />
              <Route path="producao/planejamento" element={<ProductionPlanning />} />
              <Route path="producao/calculo-custos" element={<CostCalculation />} />
              <Route path="producao/relatorios" element={<ProductionReports />} />
              <Route path="producao/bom" element={<BOMManagement />} />
              <Route path="producao/fichas-tecnicas" element={<FichasTecnicas />} />
              <Route path="producao/fichas/novo" element={<FichasTecnicas />} />
              <Route path="producao/fichas/:id" element={<FichasTecnicas />} />
              <Route path="producao/eventos" element={<EventTables />} />
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
              <Route path="seguranca/avancado" element={<EnhancedSecurity />} />
              <Route path="seguranca/anomalias" element={<SecurityAnomalies />} />
              {/* Configurações */}
              <Route path="config" element={<Config />} />
              {/* Relatórios */}
              <Route path="relatorios" element={<Reports />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </FeatureFlagRedirect>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

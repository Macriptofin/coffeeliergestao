import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { FeatureFlagRedirect } from '@/components/FeatureFlagRedirect';
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PortalRoute } from "./components/portal/PortalRoute";

// Páginas carregadas sob demanda (code-splitting) — reduz o bundle inicial e o tempo
// de tela branca em recargas. O shell (Layout/guards) permanece estático.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Materials = lazy(() => import("./pages/Materials"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Stock = lazy(() => import("./pages/Stock"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Sales = lazy(() => import("./pages/Sales"));
const Reports = lazy(() => import("./pages/Reports"));
const SecurityMonitoring = lazy(() => import("./pages/SecurityMonitoring"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Materiais = lazy(() => import("./pages/Materiais"));
const MateriaisGestao = lazy(() => import("./pages/stock/MateriaisGestao"));
const ProducaoMain = lazy(() => import("./pages/ProducaoMain"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const ContasPagar = lazy(() => import("./pages/financeiro/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/financeiro/ContasReceber"));
const FluxoCaixa = lazy(() => import("./pages/financeiro/FluxoCaixa"));
const CentrosCusto = lazy(() => import("./pages/financeiro/CentrosCusto"));
const AnaliseFinanceira = lazy(() => import("./pages/financeiro/AnaliseFinanceira"));
const DRE = lazy(() => import("./pages/financeiro/DRE"));
const PlanoContas = lazy(() => import("./pages/financeiro/PlanoContas"));
const PropostaAprovacao = lazy(() => import("./pages/PropostaAprovacao"));
const RelatoriosContabeis = lazy(() => import("./pages/financeiro/RelatoriosContabeis"));
const ContasBancarias = lazy(() => import("./pages/financeiro/ContasBancarias"));
const RecurringTransactions = lazy(() => import("./pages/financeiro/RecurringTransactions"));
const AgingReport = lazy(() => import("./pages/financeiro/AgingReport"));
const RecursosHumanos = lazy(() => import("./pages/RecursosHumanos"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const ControlePonto = lazy(() => import("./pages/rh/ControlePonto"));
const EstoqueMovimentacoes = lazy(() => import("./pages/EstoqueMovimentacoes"));
const Agenda = lazy(() => import("./pages/Agenda"));
const EnhancedSecurity = lazy(() => import("./pages/EnhancedSecurity"));
const SecurityAnomalies = lazy(() => import("./pages/SecurityAnomalies"));
const InventarioAjustes = lazy(() => import("./pages/InventarioAjustes"));
const InventarioCiclo = lazy(() => import("./pages/InventarioCiclo"));
const CostCalculation = lazy(() => import("./pages/production/CostCalculation"));
const ProductionPlanning = lazy(() => import("./pages/production/ProductionPlanning"));
const ProductionReports = lazy(() => import("./pages/production/ProductionReportsEnhanced"));
const BOMManagement = lazy(() => import("./pages/BOMManagement"));
const EventTables = lazy(() => import("./pages/EventTables"));
const FichasTecnicas = lazy(() => import("./components/FichasTecnicas"));
const MaterialEdit = lazy(() => import("./pages/MaterialEdit").then(m => ({ default: m.MaterialEdit })));
const Config = lazy(() => import("./pages/Config"));
const EstoqueRelatorios = lazy(() => import("./pages/stock/EstoqueRelatorios"));
const MateriaisProblemas = lazy(() => import("./pages/stock/MateriaisProblemas"));
const MateriaisDiagnostico = lazy(() => import("./pages/stock/MateriaisDiagnostico"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalProposta = lazy(() => import("./pages/portal/PortalProposta"));
const PortalNovoPedido = lazy(() => import("./pages/portal/PortalNovoPedido"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // dados frescos por 30s — navegar não refaz busca
      gcTime: 5 * 60_000,           // mantém cache por 5min após sair da tela
      refetchOnWindowFocus: false,  // evita flash ao voltar o foco da janela/aba
      retry: 1,
    },
  },
});

// Loader leve para o carregamento das telas sob demanda.
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FeatureFlagRedirect>
          <Toaster />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              {/* Rota pública — aprovação de proposta pelo cliente (sem login) */}
              <Route path="/aprovar/:token" element={<PropostaAprovacao />} />
              {/* Portal do cliente (autoatendimento) */}
              <Route path="/portal/login" element={<PortalLogin />} />
              <Route element={<PortalRoute />}>
                <Route path="/portal" element={<PortalHome />} />
                <Route path="/portal/novo-pedido" element={<PortalNovoPedido />} />
                <Route path="/portal/proposta/:id" element={<PortalProposta />} />
              </Route>
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
                <Route path="materiais/diagnostico" element={<MateriaisDiagnostico />} />
                <Route path="materiais/problemas" element={<MateriaisProblemas />} />

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
                <Route path="estoque/problemas" element={<MateriaisProblemas />} />
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
                {/* Categoria Financeiro — admin, manager e financial */}
                <Route element={<ProtectedRoute requiredRoles={['admin', 'manager', 'financial']} />}>
                  <Route path="financeiro" element={<Financeiro />} />
                  <Route path="financeiro/pagar" element={<ContasPagar />} />
                  <Route path="financeiro/receber" element={<ContasReceber />} />
                  <Route path="financeiro/fluxo" element={<FluxoCaixa />} />
                  <Route path="financeiro/custos" element={<CentrosCusto />} />
                  <Route path="financeiro/analises" element={<AnaliseFinanceira />} />
                  <Route path="financeiro/dre" element={<DRE />} />
                  <Route path="financeiro/plano-contas" element={<PlanoContas />} />
                  <Route path="financeiro/relatorios" element={<RelatoriosContabeis />} />
                  <Route path="financeiro/bancos" element={<ContasBancarias />} />
                  <Route path="financeiro/recorrentes" element={<RecurringTransactions />} />
                  <Route path="financeiro/aging" element={<AgingReport />} />
                  <Route path="financeiro/previsao" element={<FluxoCaixa defaultTab="previsto" />} />
                </Route>
                {/* Categoria Recursos Humanos — admin e manager */}
                <Route element={<ProtectedRoute requiredRoles={['admin', 'manager']} />}>
                  <Route path="rh" element={<RecursosHumanos />} />
                  <Route path="rh/colaboradores" element={<Colaboradores />} />
                  <Route path="rh/ponto" element={<ControlePonto />} />
                </Route>

                {/* Gestão de usuários, segurança e config — somente admin */}
                <Route element={<ProtectedRoute requiredRoles={['admin']} />}>
                  {/* /usuarios redireciona para Configurações → aba Usuários (fonte única) */}
                  <Route path="usuarios" element={<Navigate to="/config#usuarios" replace />} />
                  <Route path="seguranca" element={<SecurityMonitoring />} />
                  <Route path="seguranca/avancado" element={<EnhancedSecurity />} />
                  <Route path="seguranca/anomalias" element={<SecurityAnomalies />} />
                  <Route path="config" element={<Config />} />
                </Route>
                {/* Relatórios */}
                <Route path="relatorios" element={<Reports />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </FeatureFlagRedirect>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

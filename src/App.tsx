import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Estoque from "./pages/Estoque";
import ProducaoMain from "./pages/ProducaoMain";
import Financeiro from "./pages/Financeiro";
import RecursosHumanos from "./pages/RecursosHumanos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            {/* Categoria Estoque */}
            <Route path="estoque" element={<Estoque />} />
            <Route path="ingredientes" element={<Materials />} />
            <Route path="estoque/*" element={<Stock />} />
            {/* Categoria Compras */}
            <Route path="compras" element={<Purchases />} />
            {/* Categoria Vendas */}
            <Route path="vendas" element={<Sales />} />
            {/* Categoria Produção */}
            <Route path="producao" element={<ProducaoMain />} />
            <Route path="receitas" element={<Recipes />} />
            <Route path="producao/*" element={<Production />} />
            {/* Fornecedores */}
            <Route path="fornecedores" element={<Suppliers />} />
            {/* Categoria Financeiro */}
            <Route path="financeiro" element={<Financeiro />} />
            {/* Categoria Recursos Humanos */}
            <Route path="rh" element={<RecursosHumanos />} />
            <Route path="usuarios" element={<UserManagement />} />
            {/* Relatórios */}
            <Route path="relatorios" element={<Reports />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

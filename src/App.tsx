import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Ingredients from "./pages/Ingredients";
import Recipes from "./pages/Recipes";
import Suppliers from "./pages/Suppliers";
import Production from "./pages/Production";
import Stock from "./pages/Stock";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
            <Route path="ingredientes" element={<Ingredients />} />
            <Route path="receitas" element={<Recipes />} />
            <Route path="fornecedores" element={<Suppliers />} />
            <Route path="producao" element={<Production />} />
            <Route path="estoque" element={<Stock />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="usuarios" element={<UserManagement />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

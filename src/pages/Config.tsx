import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Palette, Building2, Package, Wrench, DollarSign, Calendar, Users } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfigGeneral } from "@/components/config/ConfigGeneral";
import { ConfigDadosEmpresa } from "@/components/config/ConfigDadosEmpresa";
import { ConfigEstoque } from "@/components/config/ConfigEstoque";
import { ConfigProducao } from "@/components/config/ConfigProducao";
import { ConfigVendas } from "@/components/config/ConfigVendas";
import { ConfigFinanceiro } from "@/components/config/ConfigFinanceiro";
import { ConfigEventos } from "@/components/config/ConfigEventos";
import { ConfigRH } from "@/components/config/ConfigRH";
import { useConfig } from "@/hooks/useConfig";

const Config = () => {
  const [activeTab, setActiveTab] = useState("empresa");
  const { loading } = useConfig();

  // Parse URL hash for deep linking
  React.useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['empresa', 'gerais', 'estoque', 'producao', 'vendas', 'financeiro', 'eventos', 'rh'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Update URL when tab changes
  React.useEffect(() => {
    window.history.replaceState(null, '', `/config#${activeTab}`);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Centro de Configurações</h1>
            <p className="text-muted-foreground">Gerencie dados da empresa e parâmetros do sistema</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="empresa" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="gerais" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Gerais</span>
            </TabsTrigger>
            <TabsTrigger value="estoque" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="producao" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Produção</span>
            </TabsTrigger>
            <TabsTrigger value="vendas" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="eventos" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Eventos</span>
            </TabsTrigger>
            <TabsTrigger value="rh" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">RH</span>
            </TabsTrigger>
          </TabsList>

          <div className="space-y-6">
            <TabsContent value="empresa" className="space-y-6 mt-0">
              <ConfigDadosEmpresa />
            </TabsContent>

            <TabsContent value="gerais" className="space-y-6 mt-0">
              <ConfigGeneral />
            </TabsContent>

            <TabsContent value="estoque" className="space-y-6 mt-0">
              <ConfigEstoque />
            </TabsContent>

            <TabsContent value="producao" className="space-y-6 mt-0">
              <ConfigProducao />
            </TabsContent>

            <TabsContent value="vendas" className="space-y-6 mt-0">
              <ConfigVendas />
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-6 mt-0">
              <ConfigFinanceiro />
            </TabsContent>

            <TabsContent value="eventos" className="space-y-6 mt-0">
              <ConfigEventos />
            </TabsContent>

            <TabsContent value="rh" className="space-y-6 mt-0">
              <ConfigRH />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default Config;

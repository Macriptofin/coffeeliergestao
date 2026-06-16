import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, CheckCircle, Plus, Package, RefreshCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOMProductionOrdersList } from "@/components/BOMProductionOrdersList";
import { ProductionOrdersList } from "@/components/ProductionOrdersList";
import { EventProductionIntegration } from "@/components/EventProductionIntegration";
import { ProductionOrderBOM } from "@/components/ProductionOrderBOM";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionSummary {
  today: number;
  inProgress: number;
  delayed: number;
  completed: number;
}

const EMPTY_SUMMARY: ProductionSummary = {
  today: 0,
  inProgress: 0,
  delayed: 0,
  completed: 0,
};

async function fetchProductionSummary(): Promise<ProductionSummary> {
  // Carregar dados das ordens BOM
  const { data: bomOrders, error: bomError } = await supabase
    .from('bom_production_orders')
    .select('status, order_date, created_at');

  if (bomError) throw bomError;

  // Carregar dados das ordens de eventos
  const { data: eventOrders, error: eventError } = await supabase
    .from('event_production_orders')
    .select(`
      status,
      created_at,
      event_table:event_tables!inner (date_start)
    `);

  if (eventError) throw eventError;

  // Calcular métricas
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allOrders = [
    ...(bomOrders || []).map(o => ({
      status: o.status,
      date: new Date(o.order_date),
      isToday: new Date(o.order_date).toDateString() === today.toDateString()
    })),
    ...(eventOrders || []).map(o => ({
      status: o.status,
      date: new Date(o.event_table.date_start),
      isToday: new Date(o.event_table.date_start).toDateString() === today.toDateString()
    }))
  ];

  return {
    today: allOrders.filter(o => o.isToday).length,
    inProgress: allOrders.filter(o => o.status === 'Em Produção').length,
    delayed: allOrders.filter(o => o.date < today && ['Planejado', 'Em Produção'].includes(o.status)).length,
    completed: allOrders.filter(o => ['Concluído', 'Cancelado'].includes(o.status)).length
  };
}

const ProductionPlanning = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'dashboard' | 'weekly' | 'monthly'>('dashboard');
  const [showNewOrder, setShowNewOrder] = useState(false);

  const {
    data: summary = EMPTY_SUMMARY,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['production-summary'], queryFn: fetchProductionSummary });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar dados do resumo');
  }, [isError]);

  const refetchSummary = () => queryClient.invalidateQueries({ queryKey: ['production-summary'] });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Planejamento de Produção</h1>
          <p className="text-muted-foreground">Gestão unificada de ordens de produção e recursos</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={refetchSummary}
            variant="outline"
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button
            onClick={() => setShowNewOrder(true)}
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Ordem (BOM)
          </Button>
        </div>
      </div>

      {/* Summary Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{summary.today}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Em Produção</p>
                <p className="text-2xl font-bold">{summary.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold">{summary.delayed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold">{summary.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Nova Ordem */}
      {showNewOrder && (
        <div className="mb-8">
          <ProductionOrderBOM
            onClose={() => {
              setShowNewOrder(false);
              refetchSummary(); // Atualizar métricas após criar ordem
            }}
          />
        </div>
      )}

      {/* Tabs de Gestão Unificada */}
      <Tabs defaultValue="bom-orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bom-orders">Ordens BOM</TabsTrigger>
          <TabsTrigger value="event-orders">Ordens de Eventos</TabsTrigger>
          <TabsTrigger value="event-integration">Gerar de Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="bom-orders" className="mt-6">
          <BOMProductionOrdersList />
        </TabsContent>

        <TabsContent value="event-orders" className="mt-6">
          <ProductionOrdersList />
        </TabsContent>

        <TabsContent value="event-integration" className="mt-6">
          <EventProductionIntegration />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionPlanning;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp } from "lucide-react";
import { StockOverview } from "@/components/stock/StockOverview";

export interface StockItem {
  id: string;
  ingredient: {
    id: string;
    name: string;
    usageUnit: string;
  };
  currentQuantity: number;
  minimumQuantity: number;
  averagePrice: number;
  totalValue: number;
  lastMovementDate?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplier?: {
    id: string;
    companyName: string;
  };
  invoiceDate: string;
  totalAmount: number;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
  stockPosted: boolean;
  stockPostedAt?: string;
}

const Stock = () => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadStockItems();
    } catch (error) {
      console.error('Erro ao carregar dados do estoque:', error);
      toast.error('Erro ao carregar dados do estoque');
    } finally {
      setLoading(false);
    }
  };

  const loadStockItems = async () => {
    const { data, error } = await supabase
      .from('stock_items')
      .select(`
        *,
        materials:material_id (
          id,
          name,
          usage_unit
        )
      `)
      .order('last_movement_date', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const formattedItems: StockItem[] = data.map(item => ({
      id: item.id,
      ingredient: {
        id: item.materials.id,
        name: item.materials.name,
        usageUnit: item.materials.usage_unit
      },
      currentQuantity: parseFloat(item.current_quantity?.toString() || '0'),
      minimumQuantity: parseFloat(item.minimum_quantity?.toString() || '0'),
      averagePrice: parseFloat(item.average_price?.toString() || '0'),
      totalValue: parseFloat(item.total_value?.toString() || '0'),
      lastMovementDate: item.last_movement_date
    }));

    setStockItems(formattedItems);
  };

  // Cálculos para resumo
  const totalStockValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockItems = stockItems.filter(item => item.currentQuantity <= item.minimumQuantity);
  const outOfStockItems = stockItems.filter(item => item.currentQuantity === 0);
  const totalItems = stockItems.length;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Controle de Estoque</h1>
        <p className="text-muted-foreground">
          Visão completa dos saldos atuais e relatórios de estoque
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-4 w-4 text-primary" />
              </div>
              Valor Total Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalStockValue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {stockItems.length} itens em estoque
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {lowStockItems.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Itens abaixo do mínimo
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <Package className="h-4 w-4 text-red-600" />
              </div>
              Sem Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {outOfStockItems.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Itens zerados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-accent-coffee" />
              </div>
              Total de Itens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-coffee">
              {totalItems}
            </div>
            <p className="text-sm text-muted-foreground">
              Itens cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Estoque Baixo */}
      {lowStockItems.length > 0 && (
        <Card className="mb-8 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerta: Itens com Estoque Baixo
            </CardTitle>
            <CardDescription className="text-orange-700">
              Os seguintes itens estão abaixo do nível mínimo e precisam de reposição
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div>
                    <p className="font-medium text-orange-900">{item.ingredient.name}</p>
                    <p className="text-sm text-orange-600">
                      Atual: {item.currentQuantity} {item.ingredient.usageUnit} | 
                      Mínimo: {item.minimumQuantity} {item.ingredient.usageUnit}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    Baixo
                  </Badge>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <p className="text-sm text-orange-600 text-center">
                  +{lowStockItems.length - 5} outros itens precisam de reposição
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs do Sistema */}
      <div className="w-full">
        <StockOverview 
          stockItems={stockItems} 
          onRefresh={loadStockItems}
        />
      </div>
    </div>
  );
};

export default Stock;
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import { StockOverview } from "@/components/stock/StockOverview";
import { PurchaseInvoices } from "@/components/stock/PurchaseInvoices";
import { StockMovements } from "@/components/stock/StockMovements";
import { SupplierProducts } from "@/components/stock/SupplierProducts";
import { ImportMaterials } from "@/components/ImportMaterials";

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
}

const Stock = () => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadStockItems(),
        loadPurchaseInvoices()
      ]);
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
        ingredients (
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
        id: item.ingredients.id,
        name: item.ingredients.name,
        usageUnit: item.ingredients.usage_unit
      },
      currentQuantity: parseFloat(item.current_quantity?.toString() || '0'),
      minimumQuantity: parseFloat(item.minimum_quantity?.toString() || '0'),
      averagePrice: parseFloat(item.average_price?.toString() || '0'),
      totalValue: parseFloat(item.total_value?.toString() || '0'),
      lastMovementDate: item.last_movement_date
    }));

    setStockItems(formattedItems);
  };

  const loadPurchaseInvoices = async () => {
    const { data, error } = await supabase
      .from('purchase_invoices')
      .select(`
        *,
        suppliers (
          id,
          company_name
        )
      `)
      .order('invoice_date', { ascending: false })
      .limit(10);

    if (error) throw error;

    const formattedInvoices: PurchaseInvoice[] = data.map(item => ({
      id: item.id,
      invoiceNumber: item.invoice_number,
      supplier: item.suppliers ? {
        id: item.suppliers.id,
        companyName: item.suppliers.company_name
      } : undefined,
      invoiceDate: item.invoice_date,
      totalAmount: parseFloat(item.total_amount?.toString() || '0'),
      status: item.status as 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado'
    }));

    setPurchaseInvoices(formattedInvoices);
  };

  // Cálculos para resumo
  const totalStockValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockItems = stockItems.filter(item => item.currentQuantity <= item.minimumQuantity);
  const pendingInvoices = purchaseInvoices.filter(invoice => invoice.status === 'Pendente');

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
        <h1 className="text-3xl font-bold mb-2">Gestão de Estoque</h1>
        <p className="text-muted-foreground">
          Controle completo de entrada, saída e preço médio dos ingredientes
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              Notas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pendingInvoices.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-accent-coffee" />
              </div>
              Preço Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-coffee">
              R$ {stockItems.length > 0 ? (totalStockValue / stockItems.reduce((sum, item) => sum + item.currentQuantity, 0) || 0).toFixed(2) : '0,00'}
            </div>
            <p className="text-sm text-muted-foreground">
              Por unidade média
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Compras
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Produtos Fornecedor
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Importações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <StockOverview 
            stockItems={stockItems} 
            onRefresh={loadStockItems}
          />
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
          <PurchaseInvoices 
            invoices={purchaseInvoices}
            onRefresh={loadPurchaseInvoices}
          />
        </TabsContent>

        <TabsContent value="movements" className="mt-6">
          <StockMovements onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <SupplierProducts onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <div className="grid gap-6 md:grid-cols-1">
            <ImportMaterials onRefresh={loadData} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Stock;
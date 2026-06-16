import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
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
    code: string;
    usageUnit: string;
    materialType: string;
    category: string;
  };
  currentQuantity: number;
  minimumQuantity: number;
  idealQty: number;
  reservedQty: number;
  committedQty: number;
  availableQty: number;
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
  workflowStatus?: 'rascunho' | 'pendente' | 'lancada';
  discountTotal?: number;
  itemsLocked?: boolean;
}

const EMPTY_STOCK_ITEMS: StockItem[] = [];

async function fetchStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from('stock_items')
    .select(`
      *,
      materials:material_id (
        id,
        name,
        code,
        usage_unit,
        material_type,
        category
      )
    `)
    .order('last_movement_date', { ascending: false, nullsFirst: false });

  if (error) throw error;

  return (data || []).map(item => {
    const current  = parseFloat(item.current_quantity?.toString() || '0');
    const reserved = parseFloat((item as any).reserved_qty?.toString() || '0');
    const committed = parseFloat((item as any).committed_qty?.toString() || '0');
    return {
      id: item.id,
      ingredient: {
        id: item.materials.id,
        name: item.materials.name,
        code: item.materials.code,
        usageUnit: item.materials.usage_unit,
        materialType: item.materials.material_type || '',
        category: item.materials.category || ''
      },
      currentQuantity: current,
      minimumQuantity: parseFloat(item.minimum_quantity?.toString() || '0'),
      idealQty: parseFloat((item as any).ideal_qty?.toString() || '0'),
      reservedQty: reserved,
      committedQty: committed,
      availableQty: Math.max(0, current - reserved - committed),
      averagePrice: parseFloat(item.average_price?.toString() || '0'),
      totalValue: parseFloat(item.total_value?.toString() || '0'),
      lastMovementDate: item.last_movement_date
    };
  });
}

const Stock = () => {
  const queryClient = useQueryClient();
  const {
    data: stockItems = EMPTY_STOCK_ITEMS,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['stock-items'], queryFn: fetchStockItems });
  const showLoader = useDelayedLoading(loading);
  const [filterType, setFilterType] = useState<'all' | 'low' | 'zero'>('all');

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar dados do estoque');
  }, [isError]);

  const refetchStockItems = () => queryClient.invalidateQueries({ queryKey: ['stock-items'] });

  // Cálculos para resumo
  const totalStockValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockItems = stockItems.filter(item => item.currentQuantity > 0 && item.currentQuantity <= item.minimumQuantity);
  const outOfStockItems = stockItems.filter(item => item.currentQuantity === 0);
  const totalItems = stockItems.length;

  // Aplicar filtro
  const getFilteredItems = () => {
    switch (filterType) {
      case 'low':
        return lowStockItems;
      case 'zero':
        return outOfStockItems;
      default:
        return stockItems;
    }
  };

  const filteredStockItems = getFilteredItems();

  if (showLoader) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Controle de Estoque</h1>
        <p className="text-muted-foreground">
          Visão completa dos saldos atuais e relatórios de estoque
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card 
          className={`shadow-soft cursor-pointer transition-all hover:shadow-md ${filterType === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilterType('all')}
        >
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

        <Card 
          className={`shadow-soft cursor-pointer transition-all hover:shadow-md ${filterType === 'low' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setFilterType('low')}
        >
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

        <Card 
          className={`shadow-soft cursor-pointer transition-all hover:shadow-md ${filterType === 'zero' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilterType('zero')}
        >
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

      {/* Indicador de Filtro Ativo */}
      {filterType !== 'all' && (
        <Card className="mb-8 border-primary bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  Filtro ativo
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {filterType === 'low' ? `Exibindo ${lowStockItems.length} itens com estoque baixo` : 
                   filterType === 'zero' ? `Exibindo ${outOfStockItems.length} itens sem estoque` : ''}
                </span>
              </div>
              <button
                onClick={() => setFilterType('all')}
                className="text-sm text-primary hover:underline"
              >
                Limpar filtro
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs do Sistema */}
      <div className="w-full">
        <StockOverview 
          stockItems={filteredStockItems} 
          onRefresh={refetchStockItems}
        />
      </div>
    </div>
  );
};

export default Stock;
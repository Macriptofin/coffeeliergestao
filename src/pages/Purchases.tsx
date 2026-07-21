import { useState, useEffect } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, FileText, TrendingUp, Package2, Clock, MessageSquare } from "lucide-react";
import { PurchaseInvoices } from "@/components/stock/PurchaseInvoices";
import { SupplierProducts } from "@/components/stock/SupplierProducts";
import { ImportMaterials } from "@/components/ImportMaterials";
import { PurchaseRequirements } from "@/components/purchase/PurchaseRequirements";
import { PurchaseRequestsList } from "@/components/purchase/PurchaseRequestsList";
import { PurchaseOrders } from "@/components/purchase/PurchaseOrders";
import { StockPlanning } from "@/components/stock/StockPlanning";
import { QuoteRequestsList } from "@/components/purchase/QuoteRequestsList";

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

const EMPTY_INVOICES: PurchaseInvoice[] = [];

async function fetchPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select(`
      *,
      suppliers (
        id,
        company_name
      )
    `)
    .order('invoice_date', { ascending: false });

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    invoiceNumber: item.invoice_number,
    supplier: item.suppliers ? {
      id: item.suppliers.id,
      companyName: item.suppliers.company_name
    } : undefined,
    invoiceDate: item.invoice_date,
    totalAmount: parseFloat(item.total_amount?.toString() || '0'),
    status: item.status as 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado',
    stockPosted: item.stock_posted || false,
    stockPostedAt: item.stock_posted_at || undefined,
    workflowStatus: (item.workflow_status || 'pendente') as 'rascunho' | 'pendente' | 'lancada',
    discountTotal: parseFloat(item.discount_total?.toString() || '0'),
    itemsLocked: item.items_locked || false
  }));
}

const HASH_TO_TAB: Record<string, string> = {
  '#cotacoes': 'quotes',
};

const Purchases = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromRequest = searchParams.get('fromRequest');
  const [activeTab, setActiveTab] = useState(() => (fromRequest ? 'quotes' : HASH_TO_TAB[location.hash] || 'requirements'));

  useEffect(() => {
    const tab = HASH_TO_TAB[location.hash];
    if (tab || fromRequest) setActiveTab(fromRequest ? 'quotes' : tab);
  }, [location.hash, fromRequest]);

  // Consumido pelo QuoteRequestForm ao pré-carregar os itens da requisição —
  // limpa o parâmetro da URL pra não repuxar o pré-preenchimento ao voltar
  // pra lista, recarregar a página ou navegar de novo pra #cotacoes.
  const clearFromRequest = () => navigate('/compras#cotacoes', { replace: true });

  const {
    data: purchaseInvoices = EMPTY_INVOICES,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['purchase-invoices'], queryFn: fetchPurchaseInvoices });

  const showLoader = useDelayedLoading(loading);

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar dados de compras');
  }, [isError]);

  const loadData = () => queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
  const loadPurchaseInvoices = () => queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });

  // Cálculos para resumo
  const pendingInvoices = purchaseInvoices.filter(invoice => invoice.status === 'Pendente');
  const totalPendingValue = pendingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const unpostedInvoices = purchaseInvoices.filter(invoice => !invoice.stockPosted);
  const totalMonthValue = purchaseInvoices
    .filter(invoice => {
      const invoiceMonth = new Date(invoice.invoiceDate).getMonth();
      const currentMonth = new Date().getMonth();
      return invoiceMonth === currentMonth;
    })
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0);

  if (showLoader) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestão de Compras</h1>
        <p className="text-muted-foreground">
          Controle completo de notas fiscais, fornecedores e movimentações de entrada
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              Total do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalMonthValue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              Compras do mês atual
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {pendingInvoices.length}
            </div>
            <p className="text-sm text-muted-foreground">
              R$ {totalPendingValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package2 className="h-4 w-4 text-blue-600" />
              </div>
              Não Lançadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {unpostedInvoices.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Notas não lançadas no estoque
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <FileText className="h-4 w-4 text-accent-coffee" />
              </div>
              Total de Notas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-coffee">
              {purchaseInvoices.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Notas cadastradas
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Tabs do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Necessidades
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Requisições
          </TabsTrigger>
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Cotações
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package2 className="h-4 w-4" />
            Fornecedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-6 space-y-6">
          <StockPlanning />
          <PurchaseRequirements />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <PurchaseRequestsList />
        </TabsContent>

        <TabsContent value="quotes" className="mt-6">
          <QuoteRequestsList initialFromRequestId={fromRequest} onConsumeFromRequest={clearFromRequest} />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <PurchaseOrders />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <PurchaseInvoices
            invoices={purchaseInvoices}
            onRefresh={loadPurchaseInvoices}
          />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <SupplierProducts onRefresh={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Purchases;
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, FileText, TrendingUp, Package2, Clock } from "lucide-react";
import { PurchaseInvoices } from "@/components/stock/PurchaseInvoices";
import { SupplierProducts } from "@/components/stock/SupplierProducts";
import { ImportMaterials } from "@/components/ImportMaterials";
import { PurchaseRequirements } from "@/components/purchase/PurchaseRequirements";
import { PurchaseRequestsList } from "@/components/purchase/PurchaseRequestsList";

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

const Purchases = () => {
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requirements');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadPurchaseInvoices();
    } catch (error) {
      console.error('Erro ao carregar dados de compras:', error);
      toast.error('Erro ao carregar dados de compras');
    } finally {
      setLoading(false);
    }
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
      .order('invoice_date', { ascending: false });

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
      status: item.status as 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado',
      stockPosted: item.stock_posted || false,
      stockPostedAt: item.stock_posted_at || undefined
    }));

    setPurchaseInvoices(formattedInvoices);
  };

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

  if (loading) {
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

      {/* Alerta de Notas Pendentes */}
      {unpostedInvoices.length > 0 && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Alerta: Notas Não Lançadas no Estoque
            </CardTitle>
            <CardDescription className="text-blue-700">
              As seguintes notas precisam ser lançadas no estoque
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {unpostedInvoices.slice(0, 5).map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div>
                    <p className="font-medium text-blue-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-blue-600">
                      {invoice.supplier?.companyName} - R$ {invoice.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    Não Lançada
                  </Badge>
                </div>
              ))}
              {unpostedInvoices.length > 5 && (
                <p className="text-sm text-blue-600 text-center">
                  +{unpostedInvoices.length - 5} outras notas precisam ser lançadas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="requirements" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            MRP - Necessidades
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Requisições
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package2 className="h-4 w-4" />
            Produtos Fornecedor
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Importações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requirements" className="mt-6">
          <PurchaseRequirements />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <PurchaseRequestsList />
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

        <TabsContent value="import" className="mt-6">
          <div className="grid gap-6 md:grid-cols-1">
            <ImportMaterials onRefresh={loadData} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Purchases;
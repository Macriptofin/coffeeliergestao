import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, TrendingUp, ShoppingCart, BarChart3, Package } from "lucide-react";
import ProposalForm from '@/components/sales/ProposalForm';
import ProposalsList from '@/components/sales/ProposalsList';
import ClientForm from '@/components/sales/ClientForm';
import ClientsList from '@/components/sales/ClientsList';
import ClientDetails from '@/components/sales/client/ClientDetails';
import ProposalCategoryComposer from '@/components/sales/ProposalCategoryComposer';
import { ProposalPDF } from '@/components/sales/ProposalPDF';
import OrdersList from '@/components/sales/OrdersList';
import SalesReports from '@/components/sales/SalesReports';
import SalesDashboard from '@/components/sales/SalesDashboard';

const Sales = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null);
  const [showProposalComposer, setShowProposalComposer] = useState(false);
  const [pdfProposalId, setPdfProposalId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  useEffect(() => {
    // Just check auth and set loading to false
    setLoading(false);
  }, []);

  const handleNewProposal = () => {
    setEditingProposalId(null);
    setShowProposalForm(true);
    setActiveTab('proposals');
  };

  const handleEditProposal = (id: string) => {
    setCreatedProposalId(id);
    setShowProposalComposer(true);
  };

  const handleViewProposal = (id: string) => {
    setCreatedProposalId(id);
    setShowProposalComposer(true);
  };

  const handlePdfProposal = (id: string) => {
    setPdfProposalId(id);
    setActiveTab('proposals');
  };

  const handleProposalSuccess = (proposalId?: string) => {
    if (proposalId) {
      setCreatedProposalId(proposalId);
      setShowProposalComposer(true);
      setShowProposalForm(false);
    } else {
      setShowProposalForm(false);
      setEditingProposalId(null);
    }
  };

  const handleProposalComposerComplete = () => {
    setShowProposalComposer(false);
    setCreatedProposalId(null);
  };

  const handleProposalComposerCancel = () => {
    setShowProposalComposer(false);
    setCreatedProposalId(null);
  };

  const handleProposalCancel = () => {
    setShowProposalForm(false);
    setEditingProposalId(null);
  };

  const handleNewClient = () => {
    setEditingClientId(null);
    setShowClientForm(true);
    setActiveTab('clients');
  };

  const handleEditClient = (id: string) => {
    setEditingClientId(id);
    setViewingClientId(null);
    setShowClientForm(true);
  };

  const handleViewClient = (id: string) => {
    setViewingClientId(id);
    setShowClientForm(false);
    setEditingClientId(null);
  };

  const handleClientSuccess = () => {
    setShowClientForm(false);
    setEditingClientId(null);
    setViewingClientId(null);
  };

  const handleClientCancel = () => {
    setShowClientForm(false);
    setEditingClientId(null);
  };

  const handleClientDetailsBack = () => {
    setViewingClientId(null);
  };

  const handleClientDetailsEdit = () => {
    if (viewingClientId) {
      setEditingClientId(viewingClientId);
      setViewingClientId(null);
      setShowClientForm(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Gestão de Vendas</h1>
        <p className="text-muted-foreground">
          Controle completo de clientes, propostas, pedidos e relatórios
        </p>
      </div>

      {/* Tabs do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 py-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2 py-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2 py-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Pedidos</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2 py-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2 py-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <SalesDashboard />
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          {viewingClientId ? (
            <ClientDetails
              clientId={viewingClientId}
              onBack={handleClientDetailsBack}
              onEdit={handleClientDetailsEdit}
            />
          ) : showClientForm ? (
            <ClientForm
              clientId={editingClientId || undefined}
              onSuccess={handleClientSuccess}
              onCancel={handleClientCancel}
            />
          ) : (
            <ClientsList
              onNewClient={handleNewClient}
              onEditClient={handleEditClient}
              onViewClient={handleViewClient}
            />
          )}
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          {pdfProposalId ? (
            <ProposalPDF
              proposalId={pdfProposalId}
              onClose={() => setPdfProposalId(null)}
            />
          ) : showProposalComposer && createdProposalId ? (
            <ProposalCategoryComposer
              proposalId={createdProposalId}
              onComplete={handleProposalComposerComplete}
              onCancel={handleProposalComposerCancel}
            />
          ) : showProposalForm ? (
            <ProposalForm
              onSuccess={handleProposalSuccess}
              onCancel={handleProposalCancel}
            />
          ) : (
            <ProposalsList
              onNewProposal={handleNewProposal}
              onEditProposal={handleEditProposal}
              onViewProposal={handleViewProposal}
              onPdfProposal={handlePdfProposal}
            />
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrdersList />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <SalesReports />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <ProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componente separado para a aba de produtos para evitar carregar dados desnecessários
const ProductsTab = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Produtos Disponíveis</h2>
          <p className="text-sm text-muted-foreground">Produtos criados a partir das receitas</p>
        </div>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product.id} className="border rounded-lg p-4 bg-card shadow-soft">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-lg truncate flex-1">{product.name}</h3>
                <span className="text-xs bg-muted px-2 py-1 rounded font-mono ml-2">
                  {product.code}
                </span>
              </div>
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded mb-3">
                {product.category}
              </span>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peso:</span>
                  <span className="font-medium">{product.unit_weight}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço:</span>
                  <span className="font-bold text-primary">
                    R$ {product.selling_price?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum produto criado ainda</p>
          <p className="text-sm mt-1">
            Vá até a página de Receitas e clique em "Lançar como Produto"
          </p>
        </div>
      )}
    </div>
  );
};

export default Sales;

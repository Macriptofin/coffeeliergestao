import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, TrendingUp, DollarSign, Plus } from "lucide-react";
import ProposalForm from '@/components/sales/ProposalForm';
import ProposalsList from '@/components/sales/ProposalsList';
import ClientForm from '@/components/sales/ClientForm';
import ClientsList from '@/components/sales/ClientsList';
import ProposalComposer from '@/components/sales/ProposalComposer';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: any;
  unit_weight: number;
  selling_price: number;
  is_active: boolean;
}

interface Proposal {
  id: string;
  proposal_number: string;
  client_id: string;
  event_category: any;
  number_of_people: number;
  target_weight_per_person: number;
  proposal_date: string;
  status: string;
  version: number;
  total_weight: number;
  total_amount: number;
}

const Sales = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null);
  const [showProposalComposer, setShowProposalComposer] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadClients(),
        loadProducts(), 
        loadProposals()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados de vendas:', error);
      toast.error('Erro ao carregar dados de vendas');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw error;
    setClients(data as any);
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    setProducts(data as any);
  };

  const loadProposals = async () => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('proposal_date', { ascending: false });

    if (error) throw error;
    setProposals(data as any);
  };

  // Cálculos para dashboard
  const activeClients = clients.filter(client => client.status === 'Ativo');
  const draftProposals = proposals.filter(proposal => proposal.status === 'Rascunho');
  const approvedProposals = proposals.filter(proposal => proposal.status === 'Aprovada');
  const monthlyRevenue = approvedProposals
    .filter(proposal => {
      const proposalMonth = new Date(proposal.proposal_date).getMonth();
      const currentMonth = new Date().getMonth();
      return proposalMonth === currentMonth;
    })
    .reduce((sum, proposal) => sum + proposal.total_amount, 0);

  const handleNewProposal = () => {
    setEditingProposalId(null);
    setShowProposalForm(true);
    setActiveTab('proposals');
  };

  const handleEditProposal = (id: string) => {
    setEditingProposalId(id);
    setShowProposalForm(true);
  };

  const handleViewProposal = (id: string) => {
    // TODO: Implement proposal view
    toast.info('Visualização de proposta será implementada em breve');
  };

  const handleProposalSuccess = (proposalId?: string) => {
    if (proposalId) {
      setCreatedProposalId(proposalId);
      setShowProposalComposer(true);
      setShowProposalForm(false);
    } else {
      setShowProposalForm(false);
      setEditingProposalId(null);
      loadProposals();
    }
  };

  const handleProposalComposerComplete = () => {
    setShowProposalComposer(false);
    setCreatedProposalId(null);
    loadProposals();
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
    setShowClientForm(true);
  };

  const handleClientSuccess = () => {
    setShowClientForm(false);
    setEditingClientId(null);
    loadClients();
  };

  const handleClientCancel = () => {
    setShowClientForm(false);
    setEditingClientId(null);
  };

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
        <h1 className="text-3xl font-bold mb-2">Gestão de Vendas</h1>
        <p className="text-muted-foreground">
          Controle completo de clientes, propostas e produtos para venda
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              Receita do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {monthlyRevenue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {approvedProposals.length} propostas aprovadas
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              Clientes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeClients.length}
            </div>
            <p className="text-sm text-muted-foreground">
              {clients.length} clientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileText className="h-4 w-4 text-orange-600" />
              </div>
              Propostas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {draftProposals.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Aguardando finalização
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-accent-coffee" />
              </div>
              Produtos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-coffee">
              {products.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Disponíveis para venda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Propostas
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Produtos por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle>Produtos por Categoria</CardTitle>
                <CardDescription>Distribuição dos produtos ativos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Salgados', 'Doces', 'Low Fat', 'Bebidas'].map(category => {
                    const categoryProducts = products.filter(p => p.category === category);
                    const percentage = products.length > 0 ? (categoryProducts.length / products.length) * 100 : 0;
                    
                    return (
                      <div key={category} className="flex justify-between items-center">
                        <span className="font-medium">{category}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground min-w-[3rem]">
                            {categoryProducts.length}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Propostas Recentes */}
            <Card>
              <CardHeader>
                <CardTitle>Propostas Recentes</CardTitle>
                <CardDescription>Últimas 5 propostas criadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proposals.slice(0, 5).map(proposal => (
                    <div key={proposal.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                      <div>
                        <p className="font-medium">{proposal.proposal_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {proposal.number_of_people} pessoas - {proposal.event_category}
                        </p>
                      </div>
                      <Badge variant={proposal.status === 'Aprovada' ? 'default' : 'secondary'}>
                        {proposal.status}
                      </Badge>
                    </div>
                  ))}
                  
                  {proposals.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhuma proposta criada ainda</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          {showClientForm ? (
            <ClientForm
              clientId={editingClientId || undefined}
              onSuccess={handleClientSuccess}
              onCancel={handleClientCancel}
            />
          ) : (
            <ClientsList
              onNewClient={handleNewClient}
              onEditClient={handleEditClient}
            />
          )}
        </TabsContent>

        <TabsContent value="proposals" className="mt-6">
          {showProposalComposer && createdProposalId ? (
            <ProposalComposer
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
            />
          )}
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Disponíveis</CardTitle>
              <CardDescription>Produtos criados a partir das receitas</CardDescription>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <Card key={product.id} className="shadow-soft">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <Badge variant="outline">{product.code}</Badge>
                        </div>
                        <Badge className="w-fit">
                          {product.category}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Peso:</span>
                            <span className="text-sm font-medium">{product.unit_weight}g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Preço:</span>
                            <span className="text-sm font-bold text-primary">
                              R$ {product.selling_price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                  <p>Nenhum produto criado ainda</p>
                  <p className="text-sm">
                    Vá até a página de Receitas e clique em "Lançar como Produto"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sales;
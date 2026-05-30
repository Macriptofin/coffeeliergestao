import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BookOpen, Building2, Calculator } from "lucide-react";
import type { Supplier } from "@/components/SupplierForm";
import { EventCalendar } from "@/components/agenda/EventCalendar";

interface DashboardIngredient {
  id: string;
  name: string;
  usage_unit: string;
  cost_price: number;
}

interface DashboardBOM {
  id: string;
  cached_total_cost: number | null;
  materials: {
    name: string;
    category: string | null;
  } | null;
}

interface DashboardEvent {
  id: string;
  event_name: string;
  event_date: string;
  status: string;
  venue?: string;
  total_people: number;
  total_weight: number;
  total_amount: number;
  clients?: {
    name: string;
  };
}

const Dashboard = () => {
  const [ingredients, setIngredients] = useState<DashboardIngredient[]>([]);
  const [boms, setBoms] = useState<DashboardBOM[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const withTimeout = async <T,>(p: Promise<T>, ms: number, name: string) => {
      return await Promise.race<PromiseSettledResult<T>>([
        p.then((res) => ({ status: 'fulfilled', value: res } as PromiseSettledResult<T>))
         .catch((err) => ({ status: 'rejected', reason: err } as PromiseSettledResult<T>)),
        new Promise<PromiseSettledResult<T>>((resolve) =>
          setTimeout(() => resolve({ status: 'rejected', reason: new Error(`${name} timeout`) }), ms)
        )
      ]);
    };

    try {
      setLoading(true);
      const results = await Promise.all([
        withTimeout(loadIngredients(), 10_000, 'ingredientes'),
        withTimeout(loadBOMs(), 10_000, 'fichas técnicas'),
        withTimeout(loadSuppliers(), 10_000, 'fornecedores'),
        withTimeout(loadEvents(), 10_000, 'eventos')
      ]);

      const failed = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ i }) => ['ingredientes', 'fichas técnicas', 'fornecedores', 'eventos'][i]);

      if (failed.length) {
        console.warn('Falhas ao carregar:', failed);
        toast.warning(`Alguns dados não carregaram: ${failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadIngredients = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, usage_unit, cost_price')
      .eq('is_archived', false)
      .order('name');
    if (error) throw error;
    setIngredients(data || []);
  };

  const loadBOMs = async () => {
    const { data, error } = await supabase
      .from('recipes_bom')
      .select(`
        id,
        cached_total_cost,
        materials!finished_material_id (
          name,
          category
        )
      `)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setBoms((data as unknown as DashboardBOM[]) || []);
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('company_name');
    if (error) throw error;
    const formattedSuppliers = (data || []).map(item => ({
      id: item.id,
      code: item.code,
      status: item.status as 'Ativo' | 'Inativo',
      companyName: item.company_name,
      tradeName: item.trade_name || undefined,
      cnpjCpf: item.cnpj_cpf || undefined,
      contactName: item.contact_name || undefined,
      phone: item.phone || undefined,
      email: item.email || undefined,
      address: item.address || undefined,
      city: item.city || undefined,
      state: item.state || undefined,
      zipCode: item.zip_code || undefined,
      mainCategory: item.main_category || undefined,
      paymentTerms: item.payment_terms || 30,
      minimumOrderValue: parseFloat(item.minimum_order_value?.toString() || '0'),
      notes: item.notes || undefined
    }));
    setSuppliers(formattedSuppliers);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, clients(name)')
      .order('event_date', { ascending: true });
    if (error) throw error;
    setEvents(data || []);
  };

  const avgBomCost = boms.length > 0
    ? boms.reduce((sum, b) => sum + (b.cached_total_cost || 0), 0) / boms.length
    : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu sistema de gestão</p>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Materiais
            </CardTitle>
            <CardDescription>Total cadastrado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{ingredients.length}</span>
              <span className="text-muted-foreground">itens</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <BookOpen className="h-4 w-4 text-accent-coffee" />
              </div>
              Fichas Técnicas
            </CardTitle>
            <CardDescription>Total ativas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-accent-coffee">{boms.length}</span>
              <span className="text-muted-foreground">fichas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              Fornecedores
            </CardTitle>
            <CardDescription>Parceiros ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600">
                {suppliers.filter(s => s.status === 'Ativo').length}
              </span>
              <span className="text-muted-foreground">ativos</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <Calculator className="h-4 w-4 text-secondary-foreground" />
              </div>
              Custo Médio
            </CardTitle>
            <CardDescription>Por ficha técnica</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-secondary-foreground">
                R$ {avgBomCost.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendário de Eventos */}
      <div className="mb-8">
        <EventCalendar
          events={events}
          onEventSelect={(event) => {
            toast.info(`Evento selecionado: ${event.event_name}`);
          }}
          onEventCreate={(_date) => {
            toast.info('Para criar um evento, acesse a página Agenda');
          }}
        />
      </div>

      {/* Resumos Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Materiais Recentes</CardTitle>
            <CardDescription>Últimos itens adicionados</CardDescription>
          </CardHeader>
          <CardContent>
            {ingredients.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum material cadastrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {ingredients.slice(-3).map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.usage_unit}</p>
                    </div>
                    <span className="font-semibold text-primary">
                      R$ {(item.cost_price || 0).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Fichas Técnicas Recentes</CardTitle>
            <CardDescription>Últimas criadas</CardDescription>
          </CardHeader>
          <CardContent>
            {boms.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma ficha técnica criada ainda
              </p>
            ) : (
              <div className="space-y-3">
                {boms.slice(0, 3).map((bom) => (
                  <div key={bom.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div>
                      <p className="font-medium">{bom.materials?.name || '—'}</p>
                      <p className="text-sm text-muted-foreground">{bom.materials?.category || '—'}</p>
                    </div>
                    <span className="font-semibold text-accent-coffee">
                      R$ {(bom.cached_total_cost || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

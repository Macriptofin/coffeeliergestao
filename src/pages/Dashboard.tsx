import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChefHat, Calculator, Building2, Calendar, Users, MapPin, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Ingredient, Recipe } from "@/types";
import type { Supplier } from "@/components/SupplierForm";
import { EventCalendar } from "@/components/agenda/EventCalendar";

interface DashboardEvent {
  id: string;
  event_name: string;
  event_date: string;
  setup_time?: string;
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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Helper to cap each fetch to 10s and name failures
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
        withTimeout(loadRecipes(), 10_000, 'receitas'),
        withTimeout(loadSuppliers(), 10_000, 'fornecedores'),
        withTimeout(loadEvents(), 10_000, 'eventos')
      ]);

      const failed = results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ i }) => ['ingredientes', 'receitas', 'fornecedores', 'eventos'][i]);

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
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    const formattedIngredients = data.map(item => ({
      id: item.id,
      name: item.name,
      purchaseUnit: item.purchase_unit,
      usageUnit: item.usage_unit,
      conversionFactor: parseFloat(item.conversion_factor.toString()),
      pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit.toString()),
      supplier: item.supplier || undefined
    }));
    
    setIngredients(formattedIngredients);
  };

  const loadRecipes = async () => {
    const { data: recipesData, error: recipesError } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_ingredients (
          quantity,
          material_id
        )
      `)
      .order('name');
    
    if (recipesError) throw recipesError;
    
    const formattedRecipes = recipesData.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      category: item.category,
      instructions: item.instructions || '',
      preparationTime: item.preparation_time || 0,
      difficulty: item.difficulty as 'Fácil' | 'Médio' | 'Difícil',
      yield: item.yield_amount,
      totalCost: item.total_cost ? parseFloat(item.total_cost.toString()) : undefined,
      suggestedPrice: item.suggested_price ? parseFloat(item.suggested_price.toString()) : undefined,
      profitMargin: item.profit_margin ? parseFloat(item.profit_margin.toString()) : undefined,
      ingredients: item.recipe_ingredients.map((ri: any) => ({
        ingredientId: ri.material_id,
        quantity: parseFloat(ri.quantity.toString())
      }))
    }));
    
    setRecipes(formattedRecipes);
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('company_name');
    
    if (error) throw error;
    
    const formattedSuppliers = data.map(item => ({
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
      .select(`
        *,
        clients(name)
      `)
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    
    setEvents(data || []);
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Ingredientes
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
                <ChefHat className="h-4 w-4 text-accent-coffee" />
              </div>
              Receitas
            </CardTitle>
            <CardDescription>Total criadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-accent-coffee">{recipes.length}</span>
              <span className="text-muted-foreground">receitas</span>
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
            <CardDescription>Por receita</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-secondary-foreground">
                R$ {recipes.length > 0 
                  ? (recipes.reduce((sum, recipe) => sum + (recipe.totalCost || 0), 0) / recipes.length).toFixed(2)
                  : '0,00'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendário de Eventos e Próximos Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-[450px]">
          <EventCalendar 
            events={events}
            onEventSelect={(event) => {
              toast.info(`Evento selecionado: ${event.event_name}`);
            }}
            onEventCreate={(date) => {
              toast.info('Para criar um evento, acesse a página Agenda');
            }}
          />
        </div>
        
        <Card className="shadow-soft h-[450px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
            <CardDescription>Eventos de hoje e futuros</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {(() => {
                const upcomingEvents = events.filter(event => {
                  if (event.status === 'Cancelado') return false;
                  
                  const now = new Date();
                  const eventDate = new Date(event.event_date);
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                  
                  if (eventDay > today) return true;
                  
                  if (eventDay.getTime() === today.getTime()) {
                    if (event.setup_time) {
                      const [hours, minutes] = event.setup_time.split(':').map(Number);
                      const eventDateTime = new Date(eventDay);
                      eventDateTime.setHours(hours, minutes, 0, 0);
                      return eventDateTime >= now;
                    }
                    return true;
                  }
                  
                  return false;
                }).slice(0, 10);

                const getStatusBadge = (status: string) => {
                  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
                    'Agendado': 'default',
                    'Em Preparação': 'secondary',
                    'Em Andamento': 'outline',
                    'Concluído': 'default',
                    'Cancelado': 'destructive'
                  };
                  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
                };

                if (upcomingEvents.length === 0) {
                  return (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum evento próximo agendado
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <div key={event.id} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm truncate flex-1">{event.event_name}</h3>
                          {getStatusBadge(event.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {event.event_date.split('T')[0].split('-').reverse().join('/')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {event.total_people}
                          </span>
                        </div>
                        {event.clients && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {event.clients.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Resumos Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Ingredientes Recentes</CardTitle>
            <CardDescription>Últimos itens adicionados</CardDescription>
          </CardHeader>
          <CardContent>
            {ingredients.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum ingrediente cadastrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {ingredients.slice(-3).map((ingredient) => (
                  <div key={ingredient.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div>
                      <p className="font-medium">{ingredient.name}</p>
                      <p className="text-sm text-muted-foreground">{ingredient.usageUnit}</p>
                    </div>
                    <span className="font-semibold text-primary">
                      R$ {(ingredient.pricePerPurchaseUnit / ingredient.conversionFactor).toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Receitas Recentes</CardTitle>
            <CardDescription>Últimas criadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recipes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma receita criada ainda
              </p>
            ) : (
              <div className="space-y-3">
                {recipes.slice(-3).map((recipe) => (
                  <div key={recipe.id} className="flex justify-between items-center p-3 bg-accent rounded-lg">
                    <div>
                      <p className="font-medium">{recipe.name}</p>
                      <p className="text-sm text-muted-foreground">{recipe.category}</p>
                    </div>
                    <span className="font-semibold text-accent-coffee">
                      R$ {recipe.totalCost?.toFixed(2) || '0,00'}
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChefHat, Calculator, Building2 } from "lucide-react";
import type { Ingredient, Recipe } from "@/types";
import type { Supplier } from "@/components/SupplierForm";
import { EventCalendar } from "@/components/agenda/EventCalendar";

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
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadIngredients(),
        loadRecipes(),
        loadSuppliers(),
        loadEvents()
      ]);
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

      {/* Calendário de Eventos */}
      <div className="mb-8">
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
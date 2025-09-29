import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
import { ProductionOrderBOM } from "@/components/ProductionOrderBOM";
import { RecipeMigrationDialog } from "@/components/RecipeMigrationDialog";
import { ProductionOrdersList } from "@/components/ProductionOrdersList";
import { EventProductionIntegration } from "@/components/EventProductionIntegration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Recipe, Ingredient } from "@/types";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const ProductionOrders = () => {
  const { flags } = useFeatureFlags();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showProductionOrder, setShowProductionOrder] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([loadRecipes(), loadIngredients()]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
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
      supplier: item.supplier || undefined,
      unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined
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
      yieldUnit: item.yield_unit || 'unidade',
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ordens de Produção</h1>
          <p className="text-muted-foreground">Gerencie as ordens de produção da sua confeitaria</p>
        </div>
        <div className="flex gap-3">
          {recipes.length > 0 && (
            <RecipeMigrationDialog 
              recipes={recipes}
              onMigrationComplete={() => {
                loadData();
                toast.success('Receitas migradas! Acesse Fichas Técnicas para gerenciar os BOMs.');
              }}
            />
          )}
          <Button 
            onClick={() => setShowProductionOrder(true)}
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Ordem (BOM)
          </Button>
        </div>
      </div>

      {showProductionOrder && (
        <div className="mb-8">
          <ProductionOrderBOM
            onClose={() => setShowProductionOrder(false)}
          />
        </div>
      )}

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className={`grid w-full ${flags.FF_HIDE_LEGACY_RECIPES ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="orders">Ordens Geradas</TabsTrigger>
          <TabsTrigger value="events">Gerar de Eventos</TabsTrigger>
          {!flags.FF_HIDE_LEGACY_RECIPES && (
            <TabsTrigger value="recipes">Receitas Disponíveis</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="orders" className="mt-6">
          <ProductionOrdersList />
        </TabsContent>
        
        <TabsContent value="events" className="mt-6">
          <EventProductionIntegration />
        </TabsContent>
        
        {!flags.FF_HIDE_LEGACY_RECIPES ? (
          <TabsContent value="recipes" className="mt-6">
            {recipes.length === 0 ? (
              <Card className="shadow-soft border-amber-200">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Cadastre receitas primeiro</h3>
                    <p className="text-muted-foreground mb-4">
                      Para criar ordens de produção, você precisa ter receitas cadastradas no sistema.
                    </p>
                    <Button onClick={() => window.location.href = '/receitas'}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Receitas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipes.map((recipe) => (
                  <Card key={recipe.id} className="shadow-soft">
                    <CardHeader>
                      <CardTitle className="text-lg">{recipe.name}</CardTitle>
                      <CardDescription>{recipe.category}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Rendimento:</span>
                          <span className="text-sm font-medium">{recipe.yield} {recipe.yieldUnit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Custo Total:</span>
                          <span className="text-sm font-medium text-primary">
                            R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Dificuldade:</span>
                          <span className="text-sm font-medium">{recipe.difficulty}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ) : (
          <div className="mt-6 p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center bg-muted/20">
            <ClipboardList className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Criar a partir de Fichas Técnicas (BOM)</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Use as fichas técnicas estruturadas para criar ordens de produção baseadas em BOM. 
              Sistema mais robusto e preciso para gerenciar sua produção.
            </p>
            <Button 
              onClick={() => window.location.href = '/producao/fichas-tecnicas'}
              variant="default"
              className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
            >
              <Plus className="h-4 w-4 mr-2" />
              Acessar Fichas Técnicas
            </Button>
          </div>
        )}
      </Tabs>
    </div>
  );
};

export default ProductionOrders;
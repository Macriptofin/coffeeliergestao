import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, ArrowRight, Package } from "lucide-react";
import { ProductionOrder } from "@/components/ProductionOrder";
import { RecipeMigrationDialog } from "@/components/RecipeMigrationDialog";
import type { Recipe, Ingredient } from "@/types";

const Production = () => {
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
      totalWeight: item.total_weight ? parseFloat(item.total_weight.toString()) : undefined,
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
          {recipes.length > 0 && (
            <span className="text-sm text-green-600">Receitas disponíveis: {recipes.length}</span>
          )}
          <Button 
            onClick={() => setShowProductionOrder(true)}
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
            disabled={recipes.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Ordem
          </Button>
        </div>
      </div>

      {recipes.length === 0 ? (
        <Card className="shadow-soft border-amber-200 mb-8">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma receita para migrar</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre receitas primeiro para depois convertê-las em fichas técnicas BOM.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => window.location.href = '/receitas'}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Receitas
                </Button>
                <Button onClick={() => window.location.href = '/producao/fichas-tecnicas'}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Ver Fichas Técnicas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-soft border-blue-200 mb-8">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="flex justify-center items-center gap-2 mb-4">
                <ClipboardList className="h-8 w-8 text-blue-500" />
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <Package className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Receitas Prontas para Migração</h3>
              <p className="text-muted-foreground mb-4">
                As receitas abaixo podem ser convertidas em fichas técnicas BOM para gerenciamento completo de produção.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showProductionOrder && (
        <div className="mb-8">
          <ProductionOrder
            recipes={recipes}
            ingredients={ingredients}
            onClose={() => setShowProductionOrder(false)}
          />
        </div>
      )}

      {recipes.length > 0 && (
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
                    <span className="text-sm font-medium">{recipe.yield} {recipe.yieldUnit || 'unidades'}</span>
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
    </div>
  );
};

export default Production;
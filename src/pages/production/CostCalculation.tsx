import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign } from "lucide-react";
import type { Recipe } from "@/types";

const CostCalculation = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
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
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
      toast.error('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  };

  const calculateCostPerUnit = (recipe: Recipe) => {
    if (!recipe.totalCost || recipe.yield === 0) return 0;
    return recipe.totalCost / recipe.yield;
  };

  const calculateCostPerKg = (recipe: Recipe) => {
    if (!recipe.totalCost || !recipe.totalWeight || recipe.totalWeight === 0) return 0;
    return recipe.totalCost / (recipe.totalWeight / 1000); // Convert to kg
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
        <h1 className="text-3xl font-bold mb-2">Cálculo de Custos</h1>
        <p className="text-muted-foreground">Análise de custos de produção e precificação</p>
      </div>

      {recipes.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma receita encontrada</h3>
              <p className="text-muted-foreground">
                Cadastre receitas para visualizar análises de custos
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recipes.map((recipe) => {
            const costPerUnit = calculateCostPerUnit(recipe);
            const costPerKg = calculateCostPerKg(recipe);
            
            return (
              <Card key={recipe.id} className="shadow-soft">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{recipe.name}</CardTitle>
                      <CardDescription>{recipe.category}</CardDescription>
                    </div>
                    <Badge variant="outline">{recipe.difficulty}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Rendimento */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Rendimento:</span>
                      <span className="font-medium">{recipe.yield} {recipe.yieldUnit}</span>
                    </div>

                    {/* Custo Total */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Custo Total:</span>
                      <span className="font-bold text-primary">
                        R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                      </span>
                    </div>

                    {/* Custo por Unidade */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Custo por {recipe.yieldUnit}:
                      </span>
                      <span className="font-medium text-green-600">
                        R$ {costPerUnit.toFixed(2)}
                      </span>
                    </div>

                    {/* Peso Total */}
                    {recipe.totalWeight && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Peso Total:</span>
                          <span className="font-medium">
                            {recipe.totalWeight >= 1000 
                              ? `${(recipe.totalWeight / 1000).toFixed(2)} kg` 
                              : `${recipe.totalWeight.toFixed(0)} g`}
                          </span>
                        </div>

                        {/* Custo por Kg */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Custo por kg:
                          </span>
                          <span className="font-medium text-blue-600">
                            R$ {costPerKg.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Preço Sugerido */}
                    {recipe.suggestedPrice && (
                      <>
                        <hr className="my-3" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Preço Sugerido:</span>
                          <span className="font-bold text-secondary">
                            R$ {recipe.suggestedPrice.toFixed(2)}
                          </span>
                        </div>
                        
                        {/* Margem de Lucro */}
                        {recipe.profitMargin && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Margem de Lucro:</span>
                            <Badge variant="secondary">
                              {recipe.profitMargin.toFixed(1)}%
                            </Badge>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CostCalculation;
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Calculator, FileText, Plus } from "lucide-react";
import { IngredientForm } from "@/components/IngredientForm";
import { RecipeForm } from "@/components/RecipeForm";
import { IngredientsList } from "@/components/IngredientsList";
import { RecipesList } from "@/components/RecipesList";
import { ProductionOrder } from "@/components/ProductionOrder";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  supplier?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  preparationTime: number;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  yield: number;
  totalCost?: number;
  suggestedPrice?: number;
  profitMargin?: number;
}

const Index = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);

  const addIngredient = (ingredient: Omit<Ingredient, 'id'>) => {
    const newIngredient = {
      ...ingredient,
      id: Date.now().toString(),
    };
    setIngredients([...ingredients, newIngredient]);
    setShowIngredientForm(false);
  };

  const addRecipe = (recipe: Omit<Recipe, 'id' | 'totalCost'>) => {
    const totalCost = recipe.ingredients.reduce((total, recipeIngredient) => {
      const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
      if (ingredient) {
        return total + (ingredient.pricePerUnit * recipeIngredient.quantity);
      }
      return total;
    }, 0);

    const newRecipe: Recipe = {
      ...recipe,
      id: Date.now().toString(),
      totalCost,
    };
    setRecipes([...recipes, newRecipe]);
    setShowRecipeForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <ChefHat className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Gestão de Confeitaria</h1>
          </div>
          <p className="text-primary-foreground/90 text-lg">
            Sistema completo para controle de custos e fichas técnicas das suas receitas
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-card shadow-soft">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Ingredientes
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              Receitas
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <div className="p-2 bg-accent-gold/20 rounded-lg">
                      <ChefHat className="h-4 w-4 text-accent-gold" />
                    </div>
                    Receitas
                  </CardTitle>
                  <CardDescription>Total criadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-accent-gold">{recipes.length}</span>
                    <span className="text-muted-foreground">receitas</span>
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
                            <p className="text-sm text-muted-foreground">{ingredient.unit}</p>
                          </div>
                          <span className="font-semibold text-primary">
                            R$ {ingredient.pricePerUnit.toFixed(2)}
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
                          <span className="font-semibold text-accent-gold">
                            R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gestão de Ingredientes</h2>
                <p className="text-muted-foreground">Cadastre e gerencie os ingredientes da sua confeitaria</p>
              </div>
              <Button 
                onClick={() => setShowIngredientForm(true)}
                className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Ingrediente
              </Button>
            </div>

            {showIngredientForm && (
              <IngredientForm 
                onSubmit={addIngredient}
                onCancel={() => setShowIngredientForm(false)}
              />
            )}

            <IngredientsList ingredients={ingredients} />
          </TabsContent>

          <TabsContent value="recipes" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gestão de Receitas</h2>
                <p className="text-muted-foreground">Crie e gerencie as receitas e fichas técnicas</p>
              </div>
              <Button 
                onClick={() => setShowRecipeForm(true)}
                className="bg-gradient-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-soft"
                disabled={ingredients.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Receita
              </Button>
            </div>

            {ingredients.length === 0 && (
              <Card className="shadow-soft border-amber-200">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <ChefHat className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Cadastre ingredientes primeiro</h3>
                    <p className="text-muted-foreground mb-4">
                      Para criar receitas, você precisa ter ingredientes cadastrados no sistema.
                    </p>
                    <Button 
                      onClick={() => setShowIngredientForm(true)}
                      variant="outline"
                      className="border-amber-200 text-amber-600 hover:bg-amber-50"
                    >
                      Cadastrar Ingredientes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showRecipeForm && ingredients.length > 0 && (
              <RecipeForm 
                ingredients={ingredients}
                onSubmit={addRecipe}
                onCancel={() => setShowRecipeForm(false)}
              />
            )}

            <RecipesList recipes={recipes} ingredients={ingredients} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Relatórios e Produção</h2>
              <p className="text-muted-foreground mb-6">Análises, relatórios e ordens de produção</p>
            </div>

            <ProductionOrder recipes={recipes} ingredients={ingredients} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle>Análise de Custos</CardTitle>
                  <CardDescription>Receitas mais e menos rentáveis</CardDescription>
                </CardHeader>
                <CardContent>
                  {recipes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Crie receitas para ver a análise de custos
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">RECEITA MAIS CARA</h4>
                        {(() => {
                          const mostExpensive = recipes.reduce((prev, current) => 
                            (prev.totalCost || 0) > (current.totalCost || 0) ? prev : current
                          );
                          return (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{mostExpensive.name}</span>
                              <span className="text-red-600 font-semibold">
                                R$ {mostExpensive.totalCost?.toFixed(2) || '0,00'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">RECEITA MAIS BARATA</h4>
                        {(() => {
                          const cheapest = recipes.reduce((prev, current) => 
                            (prev.totalCost || 0) < (current.totalCost || 0) ? prev : current
                          );
                          return (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{cheapest.name}</span>
                              <span className="text-green-600 font-semibold">
                                R$ {cheapest.totalCost?.toFixed(2) || '0,00'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle>Resumo por Categoria</CardTitle>
                  <CardDescription>Distribuição das receitas</CardDescription>
                </CardHeader>
                <CardContent>
                  {recipes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Crie receitas para ver o resumo por categoria
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const categories = recipes.reduce((acc, recipe) => {
                          acc[recipe.category] = (acc[recipe.category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);
                        
                        return Object.entries(categories).map(([category, count]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="font-medium">{category}</span>
                            <span className="text-primary font-semibold">{count} receitas</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User, Session } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Calculator, FileText, Plus, Sparkles, LogOut } from "lucide-react";
import { IngredientForm } from "@/components/IngredientForm";
import { RecipeForm } from "@/components/RecipeForm";
import { IngredientsList } from "@/components/IngredientsList";
import { RecipesList } from "@/components/RecipesList";
import { ProductionOrder } from "@/components/ProductionOrder";
import { RecipeExtractor } from "@/components/RecipeExtractor";
import { CoffeelierLogo } from "@/components/CoffeelierLogo";

export interface Ingredient {
  id: string;
  name: string;
  purchaseUnit: string; // Unidade de compra (ex: kg, pacote)
  usageUnit: string; // Unidade de uso nas receitas (ex: g, mL)
  conversionFactor: number; // Fator de conversão (ex: 1 kg = 1000g)
  pricePerPurchaseUnit: number; // Preço por unidade de compra
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
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showRecipeExtractor, setShowRecipeExtractor] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Authentication check and setup
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setAuthLoading(false);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load data when authenticated
  useEffect(() => {
    if (session) {
      loadIngredients();
      loadRecipes();
    }
  }, [session]);

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
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
    } catch (error) {
      console.error('Erro ao carregar ingredientes:', error);
      toast.error('Erro ao carregar ingredientes');
    }
  };

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients (
            quantity,
            ingredient_id
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
          ingredientId: ri.ingredient_id,
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

  const addIngredient = async (ingredient: Omit<Ingredient, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .insert({
          name: ingredient.name,
          purchase_unit: ingredient.purchaseUnit,
          usage_unit: ingredient.usageUnit,
          conversion_factor: ingredient.conversionFactor,
          price_per_purchase_unit: ingredient.pricePerPurchaseUnit,
          supplier: ingredient.supplier
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newIngredient: Ingredient = {
        id: data.id,
        name: data.name,
        purchaseUnit: data.purchase_unit,
        usageUnit: data.usage_unit,
        conversionFactor: parseFloat(data.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(data.price_per_purchase_unit.toString()),
        supplier: data.supplier || undefined
      };
      
      setIngredients([...ingredients, newIngredient]);
      setShowIngredientForm(false);
      toast.success('Ingrediente cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar ingrediente:', error);
      toast.error('Erro ao cadastrar ingrediente');
    }
  };

  const addRecipe = async (recipe: Omit<Recipe, 'id' | 'totalCost'>) => {
    try {
      const totalCost = recipe.ingredients.reduce((total, recipeIngredient) => {
        const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
        if (ingredient) {
          const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
          return total + (pricePerUsage * recipeIngredient.quantity);
        }
        return total;
      }, 0);

      const { data, error } = await supabase
        .from('recipes')
        .insert({
          name: recipe.name,
          description: recipe.description,
          category: recipe.category,
          instructions: recipe.instructions,
          preparation_time: recipe.preparationTime,
          difficulty: recipe.difficulty,
          yield_amount: recipe.yield,
          total_cost: totalCost,
          suggested_price: recipe.suggestedPrice,
          profit_margin: recipe.profitMargin
        })
        .select()
        .single();
      
      if (error) throw error;

      // Inserir ingredientes da receita
      if (recipe.ingredients.length > 0) {
        const recipeIngredientsData = recipe.ingredients.map(ri => ({
          recipe_id: data.id,
          ingredient_id: ri.ingredientId,
          quantity: ri.quantity
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(recipeIngredientsData);
        
        if (ingredientsError) throw ingredientsError;
      }

      const newRecipe: Recipe = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        category: data.category,
        instructions: data.instructions || '',
        preparationTime: data.preparation_time || 0,
        difficulty: data.difficulty as 'Fácil' | 'Médio' | 'Difícil',
        yield: data.yield_amount,
        totalCost: parseFloat(data.total_cost?.toString() || '0'),
        suggestedPrice: data.suggested_price ? parseFloat(data.suggested_price.toString()) : undefined,
        profitMargin: data.profit_margin ? parseFloat(data.profit_margin.toString()) : undefined,
        ingredients: recipe.ingredients
      };
      
      setRecipes([...recipes, newRecipe]);
      setShowRecipeForm(false);
      toast.success('Receita cadastrada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar receita:', error);
      toast.error('Erro ao cadastrar receita');
    }
  };

  const updateIngredient = async (updatedIngredient: Ingredient) => {
    try {
      const { error } = await supabase
        .from('ingredients')
        .update({
          name: updatedIngredient.name,
          purchase_unit: updatedIngredient.purchaseUnit,
          usage_unit: updatedIngredient.usageUnit,
          conversion_factor: updatedIngredient.conversionFactor,
          price_per_purchase_unit: updatedIngredient.pricePerPurchaseUnit,
          supplier: updatedIngredient.supplier
        })
        .eq('id', updatedIngredient.id);
      
      if (error) throw error;
      
      setIngredients(ingredients.map(ing => 
        ing.id === updatedIngredient.id ? updatedIngredient : ing
      ));
      setEditingIngredient(null);
      setShowIngredientForm(false);
      
      // Recalcular custos das receitas que usam este ingrediente
      const updatedRecipes = recipes.map(recipe => {
        const usesIngredient = recipe.ingredients.some(ri => ri.ingredientId === updatedIngredient.id);
        if (usesIngredient) {
          const newTotalCost = recipe.ingredients.reduce((total, recipeIngredient) => {
            const ingredient = ingredients.find(ing => 
              ing.id === recipeIngredient.ingredientId ? updatedIngredient : ing
            );
            if (ingredient?.id === updatedIngredient.id) {
              const pricePerUsage = updatedIngredient.pricePerPurchaseUnit / updatedIngredient.conversionFactor;
              return total + (pricePerUsage * recipeIngredient.quantity);
            }
            if (ingredient) {
              const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
              return total + (pricePerUsage * recipeIngredient.quantity);
            }
            return total;
          }, 0);
          
          // Atualizar custo total no banco
          supabase
            .from('recipes')
            .update({ total_cost: newTotalCost })
            .eq('id', recipe.id)
            .then();
            
          return { ...recipe, totalCost: newTotalCost };
        }
        return recipe;
      });
      setRecipes(updatedRecipes);
      
      toast.success('Ingrediente atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar ingrediente:', error);
      toast.error('Erro ao atualizar ingrediente');
    }
  };

  const updateRecipe = (updatedRecipe: Omit<Recipe, 'totalCost'>) => {
    const totalCost = updatedRecipe.ingredients.reduce((total, recipeIngredient) => {
      const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
      if (ingredient) {
        const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
        return total + (pricePerUsage * recipeIngredient.quantity);
      }
      return total;
    }, 0);

    const recipeWithCost: Recipe = {
      ...updatedRecipe,
      totalCost,
    };

    setRecipes(recipes.map(recipe => 
      recipe.id === updatedRecipe.id ? recipeWithCost : recipe
    ));
    setEditingRecipe(null);
    setShowRecipeForm(false);
  };

  const deleteIngredient = async (ingredientId: string) => {
    // Verificar se o ingrediente está sendo usado em alguma receita
    const isUsed = recipes.some(recipe => 
      recipe.ingredients.some(ri => ri.ingredientId === ingredientId)
    );
    
    if (isUsed) {
      toast.error('Este ingrediente não pode ser excluído pois está sendo usado em receitas.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', ingredientId);
      
      if (error) throw error;
      
      setIngredients(ingredients.filter(ing => ing.id !== ingredientId));
      toast.success('Ingrediente excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir ingrediente:', error);
      toast.error('Erro ao excluir ingrediente');
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);
      
      if (error) throw error;
      
      setRecipes(recipes.filter(recipe => recipe.id !== recipeId));
      toast.success('Receita excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
      toast.error('Erro ao excluir receita');
    }
  };

  const handleIngredientSubmit = (ingredientData: Omit<Ingredient, 'id'>) => {
    if (editingIngredient) {
      updateIngredient({ ...ingredientData, id: editingIngredient.id });
    } else {
      addIngredient(ingredientData);
    }
  };

  const handleRecipeSubmit = (recipeData: Omit<Recipe, 'id' | 'totalCost'>) => {
    if (editingRecipe) {
      updateRecipe({ ...recipeData, id: editingRecipe.id });
    } else {
      addRecipe(recipeData);
    }
  };

  const startEditingIngredient = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setShowIngredientForm(true);
  };

  const startEditingRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeForm(true);
  };

  const cancelIngredientForm = () => {
    setEditingIngredient(null);
    setShowIngredientForm(false);
  };

  const cancelRecipeForm = () => {
    setEditingRecipe(null);
    setShowRecipeForm(false);
  };

  const handleExtractedRecipe = (recipeData: Omit<Recipe, 'id' | 'totalCost'>, newIngredients: Omit<Ingredient, 'id'>[]) => {
    // First add new ingredients
    const addedIngredients: Ingredient[] = [];
    newIngredients.forEach(ingredient => {
      const newIngredient = {
        ...ingredient,
        id: Date.now().toString() + Math.random().toString(),
      };
      addedIngredients.push(newIngredient);
      setIngredients(prev => [...prev, newIngredient]);
    });

    // Update the ingredients array with new additions
    const allIngredients = [...ingredients, ...addedIngredients];

    // Map recipe ingredients from names to actual IDs
    const mappedIngredients = recipeData.ingredients.map(ri => {
      const ingredient = allIngredients.find(ing => 
        ing.name.toLowerCase() === ri.ingredientId.toLowerCase()
      );
      return {
        ingredientId: ingredient?.id || ri.ingredientId,
        quantity: ri.quantity
      };
    });

    // Create the recipe with mapped ingredients
    const finalRecipeData = {
      ...recipeData,
      ingredients: mappedIngredients
    };

    addRecipe(finalRecipeData);
    setShowRecipeExtractor(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render main content if user is not authenticated
  if (!session || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-gradient-coffee text-primary-foreground shadow-warm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <CoffeelierLogo size="lg" className="filter brightness-0 invert" />
              <div>
                <h1 className="text-3xl font-display font-bold">Sistema de Gestão</h1>
                <p className="text-primary-foreground/80 text-sm font-medium">
                  Controle completo da sua confeitaria
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
          <p className="text-primary-foreground/90 text-lg font-light">
            Sistema completo para controle de custos e fichas técnicas das suas receitas
          </p>
        </div>
      </div>

      {loading && (
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      )}

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
                ingredient={editingIngredient}
                existingIngredients={ingredients}
                onSubmit={handleIngredientSubmit}
                onCancel={cancelIngredientForm}
              />
            )}

            <IngredientsList 
              ingredients={ingredients} 
              onEdit={startEditingIngredient}
              onDelete={deleteIngredient}
            />
          </TabsContent>

          <TabsContent value="recipes" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gestão de Receitas</h2>
                <p className="text-muted-foreground">Crie e gerencie as receitas e fichas técnicas</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowRecipeExtractor(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-soft"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extrair com AI
                </Button>
                <Button 
                  onClick={() => setShowRecipeForm(true)}
                  className="bg-gradient-gold hover:bg-accent-gold/90 text-accent-gold-foreground shadow-soft"
                  disabled={ingredients.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
              </div>
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

            {showRecipeExtractor && (
              <RecipeExtractor
                existingIngredients={ingredients}
                onRecipeExtracted={handleExtractedRecipe}
                onCancel={() => setShowRecipeExtractor(false)}
              />
            )}

            {showRecipeForm && ingredients.length > 0 && (
              <RecipeForm 
                recipe={editingRecipe}
                ingredients={ingredients}
                onSubmit={handleRecipeSubmit}
                onCancel={cancelRecipeForm}
              />
            )}

            <RecipesList 
              recipes={recipes} 
              ingredients={ingredients}
              onEdit={startEditingRecipe}
              onDelete={deleteRecipe}
            />
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
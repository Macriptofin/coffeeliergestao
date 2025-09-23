import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Sparkles, ChefHat } from "lucide-react";
import { RecipeForm } from "@/components/RecipeForm";
import { RecipesList } from "@/components/RecipesList";
import { RecipeExtractor } from "@/components/RecipeExtractor";
import type { Recipe, Ingredient } from "./Index";

const Recipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showRecipeExtractor, setShowRecipeExtractor] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
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
  };

  const loadRecipes = async () => {
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

  const handleRecipeSubmit = (recipeData: Omit<Recipe, 'id' | 'totalCost'>) => {
    if (editingRecipe) {
      // updateRecipe({ ...recipeData, id: editingRecipe.id });
    } else {
      addRecipe(recipeData);
    }
  };

  const startEditingRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeForm(true);
  };

  const cancelRecipeForm = () => {
    setEditingRecipe(null);
    setShowRecipeForm(false);
  };

  const handleExtractedRecipe = (recipeData: Omit<Recipe, 'id' | 'totalCost'>, newIngredients: Omit<Ingredient, 'id'>[]) => {
    // Implementar lógica de extração
    setShowRecipeExtractor(false);
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestão de Receitas</h1>
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
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
            disabled={ingredients.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        </div>
      </div>

      {ingredients.length === 0 && (
        <Card className="shadow-soft border-amber-200 mb-8">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ChefHat className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Cadastre ingredientes primeiro</h3>
              <p className="text-muted-foreground mb-4">
                Para criar receitas, você precisa ter ingredientes cadastrados no sistema.
              </p>
              <Button onClick={() => window.location.href = '/ingredientes'}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Ingredientes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showRecipeForm && (
        <div className="mb-8">
          <RecipeForm
            recipe={editingRecipe}
            ingredients={ingredients}
            onSubmit={handleRecipeSubmit}
            onCancel={cancelRecipeForm}
          />
        </div>
      )}

      {showRecipeExtractor && (
        <div className="mb-8">
          <RecipeExtractor
            existingIngredients={ingredients}
            onRecipeExtracted={handleExtractedRecipe}
            onCancel={() => setShowRecipeExtractor(false)}
          />
        </div>
      )}

      <RecipesList
        recipes={recipes}
        ingredients={ingredients}
        onEdit={startEditingRecipe}
        onDelete={deleteRecipe}
      />
    </div>
  );
};

export default Recipes;
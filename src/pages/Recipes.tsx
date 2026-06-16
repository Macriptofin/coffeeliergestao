import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Sparkles, ChefHat } from "lucide-react";
import { RecipeForm } from "@/components/RecipeForm";
import { RecipesList } from "@/components/RecipesList";
import { RecipeExtractor } from "@/components/RecipeExtractor";
import type { Recipe, Ingredient } from "@/types";
import { calculateIngredientCost, calculateIngredientWeight } from "@/lib/ingredient-utils";

// Defaults estáveis a nível de módulo — evitam recriar arrays vazios a cada render
const EMPTY_RECIPES: Recipe[] = [];
const EMPTY_INGREDIENTS: Ingredient[] = [];

async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('name');

  if (error) throw error;

  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    purchaseUnit: item.purchase_unit,
    usageUnit: item.usage_unit,
    conversionFactor: parseFloat(item.conversion_factor.toString()),
    pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit.toString()),
    supplier: item.supplier || undefined,
    unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined
  }));
}

async function fetchRecipes(): Promise<Recipe[]> {
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

  return (recipesData || []).map(item => ({
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
    totalWeight: (item as any).total_weight ? parseFloat((item as any).total_weight.toString()) : undefined,
    suggestedPrice: item.suggested_price ? parseFloat(item.suggested_price.toString()) : undefined,
    profitMargin: item.profit_margin ? parseFloat(item.profit_margin.toString()) : undefined,
    ingredients: item.recipe_ingredients.map((ri: any) => ({
      ingredientId: ri.material_id,
      quantity: parseFloat(ri.quantity.toString())
    }))
  }));
}

const Recipes = () => {
  const queryClient = useQueryClient();

  const {
    data: recipes = EMPTY_RECIPES,
    isPending: loading,
    isError: recipesError,
  } = useQuery({ queryKey: ['recipes'], queryFn: fetchRecipes });

  // Ingredientes (materials) mudam raramente — cache com staleTime alto
  const {
    data: ingredients = EMPTY_INGREDIENTS,
    isError: ingredientsError,
  } = useQuery({ queryKey: ['recipes-ingredients'], queryFn: fetchIngredients, staleTime: 5 * 60_000 });

  const showLoader = useDelayedLoading(loading);

  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showRecipeExtractor, setShowRecipeExtractor] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Erro de carregamento → toast (uma vez por mudança no estado de erro)
  useEffect(() => {
    if (recipesError || ingredientsError) toast.error('Erro ao carregar dados');
  }, [recipesError, ingredientsError]);

  // Após mutações, invalida a query de receitas
  const refetchRecipes = () => queryClient.invalidateQueries({ queryKey: ['recipes'] });

  const calculateTotalsWithStockPrices = async (recipeIngredients: { ingredientId: string, quantity: number }[]) => {
    let totalCost = 0;
    let totalWeight = 0;

    for (const recipeIngredient of recipeIngredients) {
      const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
      if (ingredient) {
        // Buscar preço médio do estoque
        const { data: stockItem } = await supabase
          .from('stock_items')
          .select('average_price')
          .eq('material_id', ingredient.id)
          .single();

        // Usar preço do estoque ou preço de cadastro como fallback
        const pricePerPurchaseUnit = stockItem?.average_price || ingredient.pricePerPurchaseUnit;
        const pricePerUsageUnit = pricePerPurchaseUnit / ingredient.conversionFactor;
        const cost = pricePerUsageUnit * recipeIngredient.quantity;
        
        const weight = calculateIngredientWeight(ingredient, recipeIngredient.quantity);
        totalCost += cost;
        totalWeight += weight;
      }
    }

    return { totalCost, totalWeight };
  };

  const addRecipe = async (recipe: Omit<Recipe, 'id' | 'totalCost'>) => {
    try {
      const { totalCost, totalWeight } = await calculateTotalsWithStockPrices(recipe.ingredients);

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
          yield_unit: recipe.yieldUnit,
          total_cost: totalCost,
          total_weight: totalWeight,
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
          material_id: ri.ingredientId,
          quantity: ri.quantity
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(recipeIngredientsData);
        
        if (ingredientsError) throw ingredientsError;
      }

      refetchRecipes();
      setShowRecipeForm(false);
      toast.success('Receita cadastrada com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar receita:', error);
      toast.error('Erro ao cadastrar receita');
    }
  };

  const updateRecipe = async (recipe: Recipe) => {
    try {
      const { totalCost, totalWeight } = await calculateTotalsWithStockPrices(recipe.ingredients);

      // Atualizar receita principal
      const { error: recipeError } = await supabase
        .from('recipes')
        .update({
          name: recipe.name,
          description: recipe.description,
          category: recipe.category,
          instructions: recipe.instructions,
          preparation_time: recipe.preparationTime,
          difficulty: recipe.difficulty,
          yield_amount: recipe.yield,
          yield_unit: recipe.yieldUnit,
          total_cost: totalCost,
          total_weight: totalWeight,
          suggested_price: recipe.suggestedPrice,
          profit_margin: recipe.profitMargin
        })
        .eq('id', recipe.id);
      
      if (recipeError) throw recipeError;

      // Deletar ingredientes existentes
      const { error: deleteError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipe.id);
      
      if (deleteError) throw deleteError;

      // Inserir novos ingredientes
      if (recipe.ingredients.length > 0) {
        const recipeIngredientsData = recipe.ingredients.map(ri => ({
          recipe_id: recipe.id,
          material_id: ri.ingredientId,
          quantity: ri.quantity
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(recipeIngredientsData);
        
        if (ingredientsError) throw ingredientsError;
      }

      // Agora atualizar produtos relacionados a esta receita
      const { data: relatedProducts, error: productsQueryError } = await supabase
        .from('products')
        .select('id, name')
        .eq('recipe_id', recipe.id);

      if (productsQueryError) {
        console.warn('Erro ao buscar produtos relacionados:', productsQueryError);
      } else if (relatedProducts && relatedProducts.length > 0) {
        // Atualizar custo dos produtos relacionados
        const { error: updateProductsError } = await supabase
          .from('products')
          .update({
            cost_price: totalCost,
            unit_weight: totalWeight / 1000 // converter para kg se necessário
          })
          .eq('recipe_id', recipe.id);

        if (updateProductsError) {
          console.warn('Erro ao atualizar produtos relacionados:', updateProductsError);
        } else {
          // Buscar materiais relacionados aos produtos e atualizar preço
          for (const product of relatedProducts) {
            const { error: updateMaterialError } = await supabase
              .from('materials')
              .update({
                price_per_purchase_unit: totalCost,
                unit_weight: totalWeight
              })
              .eq('name', product.name)
              .eq('category', 'Produto Acabado');

            if (updateMaterialError) {
              console.warn('Erro ao atualizar material do produto:', updateMaterialError);
            }
          }
          
          toast.success('Receita e produtos relacionados atualizados!');
        }
      }

      refetchRecipes();
      setEditingRecipe(null);
      setShowRecipeForm(false);
      
      if (!relatedProducts || relatedProducts.length === 0) {
        toast.success('Receita atualizada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar receita:', error);
      toast.error('Erro ao atualizar receita');
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);
      
      if (error) throw error;

      refetchRecipes();
      toast.success('Receita excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
      toast.error('Erro ao excluir receita');
    }
  };

  const handleRecipeSubmit = (recipeData: Omit<Recipe, 'id' | 'totalCost'>) => {
    if (editingRecipe) {
      updateRecipe({ ...recipeData, id: editingRecipe.id, totalCost: 0 });
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

  if (showLoader) {
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
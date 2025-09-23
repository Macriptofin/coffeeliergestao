import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Calculator, TrendingUp, Package } from "lucide-react";
import type { Recipe, Ingredient } from "./Index";
import type { Supplier } from "@/components/SupplierForm";

const Reports = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadIngredients(),
        loadRecipes(),
        loadSuppliers()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos relatórios');
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

  // Cálculos para relatórios
  const totalIngredientValue = ingredients.reduce((sum, ing) => sum + ing.pricePerPurchaseUnit, 0);
  const averageRecipeCost = recipes.length > 0 
    ? recipes.reduce((sum, recipe) => sum + (recipe.totalCost || 0), 0) / recipes.length 
    : 0;
  const mostExpensiveRecipe = recipes.reduce((max, recipe) => 
    (recipe.totalCost || 0) > (max.totalCost || 0) ? recipe : max, recipes[0]);
  const activeSuppliers = suppliers.filter(s => s.status === 'Ativo').length;

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
        <h1 className="text-3xl font-bold mb-2">Relatórios</h1>
        <p className="text-muted-foreground">Análises e estatísticas do seu sistema de gestão</p>
      </div>

      {/* Relatórios Resumidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-4 w-4 text-primary" />
              </div>
              Valor Total Ingredientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalIngredientValue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              {ingredients.length} ingredientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-accent-mocca/20 rounded-lg">
                <Calculator className="h-4 w-4 text-accent-coffee" />
              </div>
              Custo Médio por Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-coffee">
              R$ {averageRecipeCost.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              Baseado em {recipes.length} receitas
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-red-600" />
              </div>
              Receita Mais Cara
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {mostExpensiveRecipe?.totalCost?.toFixed(2) || '0,00'}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {mostExpensiveRecipe?.name || 'Nenhuma receita'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              Fornecedores Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeSuppliers}
            </div>
            <p className="text-sm text-muted-foreground">
              De {suppliers.length} cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Relatórios Detalhados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Top 5 Ingredientes Mais Caros</CardTitle>
            <CardDescription>Por preço unitário de uso</CardDescription>
          </CardHeader>
          <CardContent>
            {ingredients.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum ingrediente cadastrado
              </p>
            ) : (
              <div className="space-y-3">
                {ingredients
                  .sort((a, b) => (b.pricePerPurchaseUnit / b.conversionFactor) - (a.pricePerPurchaseUnit / a.conversionFactor))
                  .slice(0, 5)
                  .map((ingredient, index) => (
                    <div key={ingredient.id} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{ingredient.name}</p>
                          <p className="text-sm text-muted-foreground">{ingredient.usageUnit}</p>
                        </div>
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
            <CardTitle>Top 5 Receitas Mais Caras</CardTitle>
            <CardDescription>Por custo total de produção</CardDescription>
          </CardHeader>
          <CardContent>
            {recipes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma receita cadastrada
              </p>
            ) : (
              <div className="space-y-3">
                {recipes
                  .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
                  .slice(0, 5)
                  .map((recipe, index) => (
                    <div key={recipe.id} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-accent-coffee text-accent-coffee-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{recipe.name}</p>
                          <p className="text-sm text-muted-foreground">{recipe.category}</p>
                        </div>
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

export default Reports;
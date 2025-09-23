import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChefHat, Clock, Users, DollarSign, FileText, Edit, Trash2 } from "lucide-react";
import { RecipeActions } from "./RecipeActions";
import type { Recipe, Ingredient } from "@/types";

interface RecipesListProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
}

export const RecipesList = ({ recipes, ingredients, onEdit, onDelete }: RecipesListProps) => {
  if (recipes.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma receita criada</h3>
            <p className="text-muted-foreground">
              Clique em "Nova Receita" para começar a criar suas fichas técnicas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDifficultyColor = (difficulty: Recipe['difficulty']) => {
    switch (difficulty) {
      case 'Fácil':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Médio':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Difícil':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {recipes.map((recipe) => (
        <Card key={recipe.id} className="shadow-soft hover:shadow-elegant transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl mb-2">{recipe.name}</CardTitle>
                <Badge variant="secondary" className="bg-accent-gold/20 text-accent-gold-foreground">
                  {recipe.category}
                </Badge>
              </div>
              <Badge className={getDifficultyColor(recipe.difficulty)}>
                {recipe.difficulty}
              </Badge>
            </div>
            {recipe.description && (
              <p className="text-muted-foreground text-sm mt-2">{recipe.description}</p>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{recipe.preparationTime || 0} min</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Rende {recipe.yield}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Custo dos Ingredientes:</span>
                <span className="font-bold text-primary">
                  R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                </span>
              </div>
              
              {recipe.suggestedPrice && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Preço Sugerido:</span>
                  <span className="font-bold text-accent-gold">
                    R$ {recipe.suggestedPrice.toFixed(2)}
                  </span>
                </div>
              )}
              
              {recipe.profitMargin && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Margem de Lucro:</span>
                  <span className="font-bold text-green-600">
                    {recipe.profitMargin}%
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Ficha Técnica
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-primary">{recipe.name}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Informações Gerais */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-accent rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Categoria</div>
                      <div className="font-semibold">{recipe.category}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Dificuldade</div>
                      <div className="font-semibold">{recipe.difficulty}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Tempo</div>
                      <div className="font-semibold">{recipe.preparationTime || 0} min</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Rendimento</div>
                      <div className="font-semibold">{recipe.yield}</div>
                    </div>
                  </div>

                  {/* Ingredientes */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2">Ingredientes</h3>
                    <div className="space-y-2">
                      {recipe.ingredients.map((recipeIngredient) => {
                        const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
                        if (!ingredient) return null;
                        
                        const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
                        const cost = pricePerUsage * recipeIngredient.quantity;
                        
                        return (
                          <div key={recipeIngredient.ingredientId} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <span className="font-medium">{ingredient.name}</span>
                              <span className="text-muted-foreground ml-2">
                                ({recipeIngredient.quantity} {ingredient.usageUnit})
                              </span>
                            </div>
                            <span className="text-sm font-medium text-primary">
                              R$ {cost.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      
                      <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20 mt-3">
                        <span className="font-semibold">Custo Total:</span>
                        <span className="text-lg font-bold text-primary">
                          R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Análise Financeira */}
                  {(recipe.suggestedPrice || recipe.profitMargin) && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 border-b pb-2">Análise Financeira</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">Custo</div>
                          <div className="text-lg font-bold text-blue-800">
                            R$ {recipe.totalCost?.toFixed(2) || '0,00'}
                          </div>
                        </div>
                        
                        {recipe.suggestedPrice && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-sm text-green-600">Preço Sugerido</div>
                            <div className="text-lg font-bold text-green-800">
                              R$ {recipe.suggestedPrice.toFixed(2)}
                            </div>
                          </div>
                        )}
                        
                        {recipe.profitMargin && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <div className="text-sm text-amber-600">Margem</div>
                            <div className="text-lg font-bold text-amber-800">
                              {recipe.profitMargin}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Modo de Preparo */}
                  {recipe.instructions && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 border-b pb-2">Modo de Preparo</h3>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-accent rounded-lg">
                        {recipe.instructions}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(recipe)}
                className="flex-1"
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(recipe.id)}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir
              </Button>
            </div>

            <RecipeActions recipe={recipe} ingredients={ingredients} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
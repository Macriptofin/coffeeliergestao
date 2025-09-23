import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Minus } from "lucide-react";
import type { Ingredient, Recipe, RecipeIngredient } from "@/types";
import { calculateIngredientCost, calculateIngredientWeight } from "@/lib/ingredient-utils";

interface RecipeFormProps {
  recipe?: Recipe | null;
  ingredients: Ingredient[];
  onSubmit: (recipe: Omit<Recipe, 'id' | 'totalCost'>) => void;
  onCancel: () => void;
}

export const RecipeForm = ({ recipe, ingredients, onSubmit, onCancel }: RecipeFormProps) => {
  const [formData, setFormData] = useState({
    name: recipe?.name || '',
    description: recipe?.description || '',
    category: recipe?.category || '',
    instructions: recipe?.instructions || '',
    preparationTime: recipe?.preparationTime?.toString() || '',
    difficulty: recipe?.difficulty || '' as Recipe['difficulty'],
    yield: recipe?.yield?.toString() || '',
    suggestedPrice: recipe?.suggestedPrice?.toString() || '',
    profitMargin: recipe?.profitMargin?.toString() || '',
  });

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients || []);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [quantity, setQuantity] = useState('');

  const categories = [
    'Bolos', 'Tortas', 'Cupcakes', 'Cookies', 'Pães', 'Docinhos', 'Sobremesas', 'Salgados', 'Outros'
  ];

  const addIngredient = () => {
    if (!selectedIngredient || !quantity) return;
    
    const existingIndex = recipeIngredients.findIndex(ing => ing.ingredientId === selectedIngredient);
    
    if (existingIndex >= 0) {
      const updated = [...recipeIngredients];
      updated[existingIndex].quantity = parseFloat(quantity);
      setRecipeIngredients(updated);
    } else {
      setRecipeIngredients([
        ...recipeIngredients,
        { ingredientId: selectedIngredient, quantity: parseFloat(quantity) }
      ]);
    }
    
    setSelectedIngredient('');
    setQuantity('');
  };

  const removeIngredient = (ingredientId: string) => {
    setRecipeIngredients(recipeIngredients.filter(ing => ing.ingredientId !== ingredientId));
  };

  const calculateTotalCost = () => {
    return recipeIngredients.reduce((total, recipeIngredient) => {
      const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
      if (ingredient) {
        return total + calculateIngredientCost(ingredient, recipeIngredient.quantity);
      }
      return total;
    }, 0);
  };

  const calculateTotalWeight = () => {
    return recipeIngredients.reduce((total, recipeIngredient) => {
      const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
      if (ingredient) {
        return total + calculateIngredientWeight(ingredient, recipeIngredient.quantity);
      }
      return total;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.difficulty || recipeIngredients.length === 0) return;

    onSubmit({
      name: formData.name,
      description: formData.description,
      category: formData.category,
      ingredients: recipeIngredients,
      instructions: formData.instructions,
      preparationTime: parseInt(formData.preparationTime) || 0,
      difficulty: formData.difficulty,
      yield: parseInt(formData.yield) || 1,
      suggestedPrice: formData.suggestedPrice ? parseFloat(formData.suggestedPrice) : undefined,
      profitMargin: formData.profitMargin ? parseFloat(formData.profitMargin) : undefined,
    });
  };

  const totalCost = calculateTotalCost();
  const totalWeight = calculateTotalWeight();

  return (
    <Card className="shadow-elegant border-accent-gold/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-accent-gold">
            {recipe ? 'Editar Receita' : 'Nova Receita'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Receita *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Bolo de Chocolate"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição da receita..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Dificuldade *</Label>
                <Select value={formData.difficulty} onValueChange={(value: Recipe['difficulty']) => setFormData({ ...formData, difficulty: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fácil">Fácil</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Difícil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="time">Tempo (min)</Label>
                <Input
                  id="time"
                  type="number"
                  value={formData.preparationTime}
                  onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                  placeholder="60"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="yield">Rendimento</Label>
                <Input
                  id="yield"
                  type="number"
                  value={formData.yield}
                  onChange={(e) => setFormData({ ...formData, yield: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* Ingredientes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Ingredientes</h3>
            
            <div className="flex gap-2">
              <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.usageUnit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Qtd"
                className="w-24"
              />
              
              <Button type="button" onClick={addIngredient} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {recipeIngredients.length > 0 && (
              <div className="space-y-2">
                {recipeIngredients.map((recipeIngredient) => {
                  const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
                  if (!ingredient) return null;
                  
                  const cost = calculateIngredientCost(ingredient, recipeIngredient.quantity);
                  const weight = calculateIngredientWeight(ingredient, recipeIngredient.quantity);
                  
                  return (
                    <div key={recipeIngredient.ingredientId} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{ingredient.name}</span>
                        <Badge variant="outline">
                          {recipeIngredient.quantity} {ingredient.usageUnit}
                        </Badge>
                        <Badge variant="secondary">
                          {weight.toFixed(1)}g
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-primary">
                          R$ {cost.toFixed(2)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(recipeIngredient.ingredientId)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                    <span className="font-semibold">Custo Total:</span>
                    <span className="text-lg font-bold text-primary">R$ {totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-accent-gold/10 rounded-lg border-2 border-accent-gold/20">
                    <span className="font-semibold">Peso Total:</span>
                    <span className="text-lg font-bold text-accent-gold">{(totalWeight / 1000).toFixed(3)} kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Precificação */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Precificação (Opcional)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="margin">Margem de Lucro (%)</Label>
                <Input
                  id="margin"
                  type="number"
                  step="0.01"
                  value={formData.profitMargin}
                  onChange={(e) => setFormData({ ...formData, profitMargin: e.target.value })}
                  placeholder="50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Preço Sugerido (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.suggestedPrice}
                  onChange={(e) => setFormData({ ...formData, suggestedPrice: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Instruções */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Modo de Preparo</h3>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Instruções</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Descreva o passo a passo do preparo..."
                rows={6}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-gradient-gold text-accent-gold-foreground flex-1">
              {recipe ? 'Atualizar Receita' : 'Criar Receita'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
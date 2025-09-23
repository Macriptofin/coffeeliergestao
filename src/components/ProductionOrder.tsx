import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import { Plus, Minus, Printer, FileDown, ShoppingCart, X } from "lucide-react";
import { PrintableProductionOrder } from "./PrintableProductionOrder";
import type { Recipe, Ingredient } from "@/pages/Index";

interface ProductionOrderProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
}

interface ProductionItem {
  recipeId: string;
  quantity: number;
  multiplier: number;
}

interface ConsolidatedIngredient {
  ingredient: Ingredient;
  totalQuantity: number;
  totalCost: number;
  usedInRecipes: { recipeName: string; quantity: number }[];
}

export const ProductionOrder = ({ recipes, ingredients }: ProductionOrderProps) => {
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [multiplier, setMultiplier] = useState('1');
  const [orderName, setOrderName] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ordem_Producao_${orderName.replace(/\s+/g, '_') || 'Sem_Nome'}`,
  });

  const addProductionItem = () => {
    if (!selectedRecipe || !quantity || !multiplier) return;
    
    const existingIndex = productionItems.findIndex(item => item.recipeId === selectedRecipe);
    
    if (existingIndex >= 0) {
      const updated = [...productionItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: parseInt(quantity),
        multiplier: parseFloat(multiplier)
      };
      setProductionItems(updated);
    } else {
      setProductionItems([
        ...productionItems,
        {
          recipeId: selectedRecipe,
          quantity: parseInt(quantity),
          multiplier: parseFloat(multiplier)
        }
      ]);
    }
    
    setSelectedRecipe('');
    setQuantity('1');
    setMultiplier('1');
  };

  const removeProductionItem = (recipeId: string) => {
    setProductionItems(productionItems.filter(item => item.recipeId !== recipeId));
  };

  const updateProductionItem = (recipeId: string, field: keyof ProductionItem, value: number) => {
    setProductionItems(productionItems.map(item => 
      item.recipeId === recipeId ? { ...item, [field]: value } : item
    ));
  };

  const consolidateIngredients = (): ConsolidatedIngredient[] => {
    const consolidated: { [key: string]: ConsolidatedIngredient } = {};

    productionItems.forEach(productionItem => {
      const recipe = recipes.find(r => r.id === productionItem.recipeId);
      if (!recipe) return;

      recipe.ingredients.forEach(recipeIngredient => {
        const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
        if (!ingredient) return;

        const totalNeeded = recipeIngredient.quantity * productionItem.quantity * productionItem.multiplier;
        const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
        const cost = totalNeeded * pricePerUsage;

        if (consolidated[ingredient.id]) {
          consolidated[ingredient.id].totalQuantity += totalNeeded;
          consolidated[ingredient.id].totalCost += cost;
          consolidated[ingredient.id].usedInRecipes.push({
            recipeName: recipe.name,
            quantity: totalNeeded
          });
        } else {
          consolidated[ingredient.id] = {
            ingredient,
            totalQuantity: totalNeeded,
            totalCost: cost,
            usedInRecipes: [{
              recipeName: recipe.name,
              quantity: totalNeeded
            }]
          };
        }
      });
    });

    return Object.values(consolidated).sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));
  };

  const getTotalProductionCost = () => {
    return consolidateIngredients().reduce((total, item) => total + item.totalCost, 0);
  };

  const getTotalProductionValue = () => {
    return productionItems.reduce((total, productionItem) => {
      const recipe = recipes.find(r => r.id === productionItem.recipeId);
      if (!recipe || !recipe.suggestedPrice) return total;
      
      const recipeTotal = recipe.suggestedPrice * productionItem.quantity * productionItem.multiplier;
      return total + recipeTotal;
    }, 0);
  };

  const consolidatedIngredients = consolidateIngredients();
  const totalCost = getTotalProductionCost();
  const totalValue = getTotalProductionValue();

  return (
    <div className="space-y-6">
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Criar Ordem de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações da Ordem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderName">Nome da Ordem</Label>
              <Input
                id="orderName"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="Ex: Produção Semanal - Bolos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderDate">Data de Produção</Label>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
          </div>

          {/* Adicionar Receitas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Adicionar Receitas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Select value={selectedRecipe} onValueChange={setSelectedRecipe}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma receita" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Qtd"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Multiplicador</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  placeholder="1.0"
                />
              </div>
              
              <Button onClick={addProductionItem} disabled={!selectedRecipe || !quantity || !multiplier}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de Receitas na Produção */}
          {productionItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Receitas na Ordem</h3>
              
              <div className="space-y-3">
                {productionItems.map((productionItem) => {
                  const recipe = recipes.find(r => r.id === productionItem.recipeId);
                  if (!recipe) return null;
                  
                  const itemCost = (recipe.totalCost || 0) * productionItem.quantity * productionItem.multiplier;
                  const itemValue = (recipe.suggestedPrice || 0) * productionItem.quantity * productionItem.multiplier;
                  
                  return (
                    <div key={productionItem.recipeId} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{recipe.name}</h4>
                          <Badge variant="secondary">{recipe.category}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Rendimento original: {recipe.yield} | 
                          Total produzido: {recipe.yield * productionItem.quantity * productionItem.multiplier}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <Label className="text-xs">Qtd</Label>
                            <Input
                              type="number"
                              min="1"
                              value={productionItem.quantity}
                              onChange={(e) => updateProductionItem(productionItem.recipeId, 'quantity', parseInt(e.target.value))}
                              className="w-16 h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Mult</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={productionItem.multiplier}
                              onChange={(e) => updateProductionItem(productionItem.recipeId, 'multiplier', parseFloat(e.target.value))}
                              className="w-16 h-8"
                            />
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary">
                            Custo: R$ {itemCost.toFixed(2)}
                          </div>
                          {itemValue > 0 && (
                            <div className="text-sm font-medium text-green-600">
                              Valor: R$ {itemValue.toFixed(2)}
                            </div>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProductionItem(productionItem.recipeId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Resumo Total */}
                <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Custo Total</div>
                      <div className="text-xl font-bold text-primary">R$ {totalCost.toFixed(2)}</div>
                    </div>
                    {totalValue > 0 && (
                      <>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Valor Total</div>
                          <div className="text-xl font-bold text-green-600">R$ {totalValue.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Margem Estimada</div>
                          <div className="text-xl font-bold text-accent-gold">
                            {totalCost > 0 ? (((totalValue - totalCost) / totalCost) * 100).toFixed(1) : '0'}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista Consolidada de Ingredientes */}
          {consolidatedIngredients.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Lista de Compras Consolidada</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {consolidatedIngredients.map((item) => (
                  <Card key={item.ingredient.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm">{item.ingredient.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {item.ingredient.usageUnit}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Quantidade:</span>
                          <span className="font-semibold">{item.totalQuantity.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Custo:</span>
                          <span className="font-semibold text-primary">R$ {item.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {item.usedInRecipes.length > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Usado em {item.usedInRecipes.length} receitas
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          {productionItems.length > 0 && (
            <div className="flex gap-3 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary flex-1">
                    <Printer className="h-4 w-4 mr-2" />
                    Gerar Ordem de Produção
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4 no-print">
                      <h3 className="text-lg font-semibold">Ordem de Produção</h3>
                      <Button onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>
                    <PrintableProductionOrder 
                      ref={printRef}
                      orderName={orderName}
                      orderDate={orderDate}
                      productionItems={productionItems}
                      recipes={recipes}
                      ingredients={ingredients}
                      consolidatedIngredients={consolidatedIngredients}
                      totalCost={totalCost}
                      totalValue={totalValue}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
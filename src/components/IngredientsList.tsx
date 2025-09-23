import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package2, Edit, Trash2 } from "lucide-react";
import type { Ingredient } from "@/pages/Index";

interface IngredientsListProps {
  ingredients: Ingredient[];
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredientId: string) => void;
}

export const IngredientsList = ({ ingredients, onEdit, onDelete }: IngredientsListProps) => {
  if (ingredients.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum ingrediente cadastrado</h3>
            <p className="text-muted-foreground">
              Clique em "Novo Ingrediente" para começar a cadastrar os ingredientes da sua confeitaria.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ingredients.map((ingredient) => (
        <Card key={ingredient.id} className="shadow-soft hover:shadow-elegant transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="truncate">{ingredient.name}</span>
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                {ingredient.unit}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Preço por {ingredient.unit}</span>
                <span className="font-semibold text-lg text-primary">
                  R$ {ingredient.pricePerUnit.toFixed(2)}
                </span>
              </div>
              
              {ingredient.supplier && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Fornecedor</span>
                  <span className="text-sm font-medium text-accent-gold">
                    {ingredient.supplier}
                  </span>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(ingredient)}
                  className="flex-1"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(ingredient.id)}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Package, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Recipe } from "@/types";

interface RecipeMigrationDialogProps {
  recipes: Recipe[];
  onMigrationComplete: () => void;
}

export const RecipeMigrationDialog = ({ recipes, onMigrationComplete }: RecipeMigrationDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRecipe, setCurrentRecipe] = useState<string>("");
  const [migratedCount, setMigratedCount] = useState(0);

  const migrateRecipes = async () => {
    setMigrating(true);
    setProgress(0);
    setMigratedCount(0);

    try {
      for (let i = 0; i < recipes.length; i++) {
        const recipe = recipes[i];
        setCurrentRecipe(recipe.name);
        setProgress((i / recipes.length) * 100);

        // 1. Determinar se é produto intermediário ou acabado
        // Lógica: receitas com nomes que indicam "base", "massa", "recheio" são intermediárias
        const intermediaryKeywords = ['base', 'massa', 'recheio', 'cobertura', 'creme', 'molho', 'tempero'];
        const isIntermediate = intermediaryKeywords.some(keyword => 
          recipe.name.toLowerCase().includes(keyword)
        ) || recipe.category.toLowerCase().includes('base');

        const materialType = isIntermediate ? 'intermediate_product' : 'finished_product';
        const category = isIntermediate ? 'Produto Intermediário' : 'Produto Acabado';

        // 2. Criar material do tipo apropriado
        const { data: materialData, error: materialError } = await supabase
          .from('materials')
          .insert({
            name: recipe.name,
            description: recipe.description || `${isIntermediate ? 'Receita-base' : 'Produto acabado'} baseado na receita ${recipe.name}`,
            category: category,
            material_type: materialType,
            purchase_unit: recipe.yieldUnit || 'unidade',
            usage_unit: recipe.yieldUnit || 'unidade',
            conversion_factor: 1,
            price_per_purchase_unit: recipe.totalCost || 0,
            unit_weight: recipe.totalWeight || 0,
            is_sellable: !isIntermediate // Intermediários não são vendáveis
          })
          .select()
          .single();

        if (materialError) {
          console.error(`Erro ao criar material para ${recipe.name}:`, materialError);
          continue;
        }

        // 3. Criar BOM para o produto (acabado ou intermediário)
        const { data: bomData, error: bomError } = await supabase
          .from('recipes_bom')
          .insert({
            finished_material_id: materialData.id,
            yield_quantity: recipe.yield,
            yield_unit: recipe.yieldUnit || 'unidade',
            waste_percentage: 0,
            notes: `BOM migrado da receita "${recipe.name}". ${isIntermediate ? '[RECEITA-BASE] - ' : ''}${recipe.instructions ? 'Instruções: ' + recipe.instructions : ''}`
          })
          .select()
          .single();

        if (bomError) {
          console.error(`Erro ao criar BOM para ${recipe.name}:`, bomError);
          continue;
        }

        // 4. Migrar ingredientes da receita para itens do BOM
        if (recipe.ingredients && recipe.ingredients.length > 0) {
          const bomItems = recipe.ingredients.map((ingredient, index) => ({
            recipe_id: bomData.id,
            material_id: ingredient.ingredientId,
            quantity: ingredient.quantity,
            unit: 'g', // Assumindo gramas como padrão
            position: index + 1,
            waste_percentage: 0,
            is_packaging: false
          }));

          const { error: itemsError } = await supabase
            .from('recipe_bom_items')
            .insert(bomItems);

          if (itemsError) {
            console.error(`Erro ao criar itens do BOM para ${recipe.name}:`, itemsError);
          }
        }

        setMigratedCount(i + 1);
      }

      setProgress(100);
      toast.success(`${recipes.length} receitas migradas com sucesso para fichas técnicas BOM!`);
      onMigrationComplete();
      setIsOpen(false);

    } catch (error) {
      console.error('Erro durante migração:', error);
      toast.error('Erro durante a migração das receitas');
    } finally {
      setMigrating(false);
      setCurrentRecipe("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Migrar para Fichas Técnicas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Migrar Receitas para Fichas Técnicas BOM
          </DialogTitle>
          <DialogDescription>
            Converta suas receitas em fichas técnicas BOM. Receitas-base (massas, cremes, etc.) se tornarão Produtos Intermediários, 
            enquanto produtos finais se tornarão Produtos Acabados. Intermediários não aparecerão nas vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                O que será feito:
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">1</span>
                </div>
                <div>
                  <div className="font-medium">Classificar Automaticamente</div>
                  <div className="text-sm text-muted-foreground">
                    Receitas-base (massa, creme, base) → Produtos Intermediários (não vendáveis)
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-green-600">2</span>
                </div>
                <div>
                  <div className="font-medium">Criar BOMs</div>
                  <div className="text-sm text-muted-foreground">
                    Configurar a ficha técnica com rendimento e especificações
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-purple-600">3</span>
                </div>
                <div>
                  <div className="font-medium">Migrar Ingredientes</div>
                  <div className="text-sm text-muted-foreground">
                    Todos os ingredientes serão transferidos para o BOM
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receitas a Migrar ({recipes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {recipes.map((recipe) => {
                  // Determinar se é intermediário
                  const intermediaryKeywords = ['base', 'massa', 'recheio', 'cobertura', 'creme', 'molho', 'tempero'];
                  const isIntermediate = intermediaryKeywords.some(keyword => 
                    recipe.name.toLowerCase().includes(keyword)
                  ) || recipe.category.toLowerCase().includes('base');
                  
                  return (
                    <div key={recipe.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{recipe.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {recipe.category} • {recipe.yield} {recipe.yieldUnit || 'unidades'}
                        </div>
                        {isIntermediate && (
                          <div className="text-xs text-amber-600 font-medium mt-1">
                            → Será classificado como Produto Intermediário (não vendável)
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-xs">
                          {recipe.ingredients?.length || 0} ingredientes
                        </Badge>
                        {isIntermediate && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                            Intermediário
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {migrating && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Progresso da Migração</span>
                    <span className="text-sm text-muted-foreground">
                      {migratedCount} de {recipes.length}
                    </span>
                  </div>
                  <Progress value={progress} className="w-full" />
                  {currentRecipe && (
                    <div className="text-sm text-muted-foreground">
                      Migrando: {currentRecipe}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={migrating}
            >
              Cancelar
            </Button>
            <Button
              onClick={migrateRecipes}
              disabled={migrating || recipes.length === 0}
              className="gap-2"
            >
              {migrating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Migrando...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Iniciar Migração
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
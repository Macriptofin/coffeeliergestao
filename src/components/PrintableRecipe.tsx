import { forwardRef } from "react";
import type { Recipe, Ingredient } from "@/types";

interface PrintableRecipeProps {
  recipe: Recipe;
  ingredients: Ingredient[];
}

export const PrintableRecipe = forwardRef<HTMLDivElement, PrintableRecipeProps>(
  ({ recipe, ingredients }, ref) => {
    const totalCost = recipe.totalCost || 0;
    const costPerUnit = recipe.yield > 0 ? totalCost / recipe.yield : totalCost;

    return (
      <div ref={ref} className="print-recipe bg-white text-black p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{recipe.name}</h1>
          <p className="text-lg text-gray-600">FICHA TÉCNICA DE PRODUÇÃO</p>
        </div>

        {/* Informações Gerais */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
              INFORMAÇÕES GERAIS
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Categoria:</span>
                <span>{recipe.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Dificuldade:</span>
                <span>{recipe.difficulty}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Tempo de Preparo:</span>
                <span>{recipe.preparationTime || 0} minutos</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Rendimento:</span>
                <span>{recipe.yield} {recipe.yieldUnit || 'unidade'}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
              ANÁLISE DE CUSTOS
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Custo Total:</span>
                <span className="font-bold">R$ {totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Custo por {recipe.yieldUnit || 'unidade'}:</span>
                <span className="font-bold">R$ {costPerUnit.toFixed(2)}</span>
              </div>
              {recipe.suggestedPrice && (
                <div className="flex justify-between">
                  <span className="font-semibold">Preço Sugerido:</span>
                  <span className="font-bold text-green-700">R$ {recipe.suggestedPrice.toFixed(2)}</span>
                </div>
              )}
              {recipe.profitMargin && (
                <div className="flex justify-between">
                  <span className="font-semibold">Margem de Lucro:</span>
                  <span className="font-bold text-blue-700">{recipe.profitMargin}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Descrição */}
        {recipe.description && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
              DESCRIÇÃO
            </h2>
            <p className="text-gray-700 leading-relaxed">{recipe.description}</p>
          </div>
        )}

        {/* Ingredientes */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            LISTA DE INGREDIENTES
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-4 py-2 text-left font-bold">INGREDIENTE</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">QUANTIDADE</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">UNIDADE</th>
                  <th className="border border-gray-400 px-4 py-2 text-right font-bold">CUSTO (R$)</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((recipeIngredient, index) => {
                  const ingredient = ingredients.find(ing => ing.id === recipeIngredient.ingredientId);
                  if (!ingredient) return null;
                  
                  const pricePerUsage = ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
                  const cost = pricePerUsage * recipeIngredient.quantity;
                  
                  return (
                    <tr key={ingredient.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-400 px-4 py-2 font-medium">{ingredient.name}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{recipeIngredient.quantity}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{ingredient.usageUnit}</td>
                      <td className="border border-gray-400 px-4 py-2 text-right font-semibold">
                        {cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-400 px-4 py-2" colSpan={3}>CUSTO TOTAL DOS INGREDIENTES</td>
                  <td className="border border-gray-400 px-4 py-2 text-right text-lg">
                    R$ {totalCost.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Modo de Preparo */}
        {recipe.instructions && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
              MODO DE PREPARO
            </h2>
            <div className="bg-gray-50 p-4 rounded border">
              <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">
                {recipe.instructions}
              </pre>
            </div>
          </div>
        )}

        {/* Observações */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            OBSERVAÇÕES DE PRODUÇÃO
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">CONTROLE DE QUALIDADE:</h3>
                <div className="space-y-1 text-gray-600">
                  <p>□ Verificar temperatura dos ingredientes</p>
                  <p>□ Conferir peso dos ingredientes</p>
                  <p>□ Verificar tempo de preparo</p>
                  <p>□ Controlar temperatura de cocção</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">ARMAZENAMENTO:</h3>
                <div className="space-y-1 text-gray-600">
                  <p>□ Temperatura adequada</p>
                  <p>□ Embalagem apropriada</p>
                  <p>□ Data de produção</p>
                  <p>□ Prazo de validade</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-4 mt-8">
          <div className="grid grid-cols-3 gap-8 text-sm text-gray-600">
            <div>
              <p className="font-semibold">PRODUZIDO POR:</p>
              <p className="mt-2">_________________________</p>
            </div>
            <div>
              <p className="font-semibold">DATA DE PRODUÇÃO:</p>
              <p className="mt-2">_________________________</p>
            </div>
            <div>
              <p className="font-semibold">LOTE/BATCH:</p>
              <p className="mt-2">_________________________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
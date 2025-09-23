import { forwardRef } from "react";
import type { Recipe, Ingredient } from "@/pages/Index";

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

interface PrintableProductionOrderProps {
  orderName: string;
  orderDate: string;
  productionItems: ProductionItem[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  consolidatedIngredients: ConsolidatedIngredient[];
  totalCost: number;
  totalValue: number;
}

export const PrintableProductionOrder = forwardRef<HTMLDivElement, PrintableProductionOrderProps>(
  ({ orderName, orderDate, productionItems, recipes, consolidatedIngredients, totalCost, totalValue }, ref) => {
    return (
      <div ref={ref} className="print-recipe bg-white text-black p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ORDEM DE PRODUÇÃO</h1>
          <h2 className="text-xl text-gray-600">{orderName || 'Sem Nome'}</h2>
          <p className="text-lg text-gray-600">Data: {new Date(orderDate).toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-3 gap-6 mb-8 p-4 bg-gray-100 rounded">
          <div className="text-center">
            <h3 className="font-bold text-gray-700 mb-2">CUSTO TOTAL</h3>
            <p className="text-2xl font-bold text-red-600">R$ {totalCost.toFixed(2)}</p>
          </div>
          {totalValue > 0 && (
            <>
              <div className="text-center">
                <h3 className="font-bold text-gray-700 mb-2">VALOR ESTIMADO</h3>
                <p className="text-2xl font-bold text-green-600">R$ {totalValue.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-gray-700 mb-2">MARGEM</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {totalCost > 0 ? (((totalValue - totalCost) / totalCost) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </>
          )}
        </div>

        {/* Receitas a Produzir */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            RECEITAS A PRODUZIR
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-4 py-2 text-left font-bold">RECEITA</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">CATEGORIA</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">QTD</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">MULT</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">TOTAL UNIDADES</th>
                  <th className="border border-gray-400 px-4 py-2 text-right font-bold">CUSTO</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {productionItems.map((productionItem, index) => {
                  const recipe = recipes.find(r => r.id === productionItem.recipeId);
                  if (!recipe) return null;
                  
                  const totalUnits = recipe.yield * productionItem.quantity * productionItem.multiplier;
                  const itemCost = (recipe.totalCost || 0) * productionItem.quantity * productionItem.multiplier;
                  
                  return (
                    <tr key={productionItem.recipeId} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-400 px-4 py-2 font-medium">{recipe.name}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{recipe.category}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{productionItem.quantity}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{productionItem.multiplier}x</td>
                      <td className="border border-gray-400 px-4 py-2 text-center font-semibold">{totalUnits}</td>
                      <td className="border border-gray-400 px-4 py-2 text-right font-semibold">
                        R$ {itemCost.toFixed(2)}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-center">
                        <div className="flex items-center justify-center">
                          <input type="checkbox" className="w-4 h-4" />
                          <span className="ml-2 text-sm">Concluído</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista de Compras Consolidada */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            LISTA DE COMPRAS CONSOLIDADA
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-4 py-2 text-left font-bold">INGREDIENTE</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">QUANTIDADE TOTAL</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">UNIDADE</th>
                  <th className="border border-gray-400 px-4 py-2 text-right font-bold">CUSTO TOTAL</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">COMPRADO</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedIngredients.map((item, index) => (
                  <tr key={item.ingredient.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-400 px-4 py-2 font-medium">{item.ingredient.name}</td>
                    <td className="border border-gray-400 px-4 py-2 text-center font-semibold">
                      {item.totalQuantity.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-4 py-2 text-center">{item.ingredient.usageUnit}</td>
                    <td className="border border-gray-400 px-4 py-2 text-right font-semibold">
                      R$ {item.totalCost.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-4 py-2 text-center">
                      <input type="checkbox" className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-400 px-4 py-2" colSpan={3}>CUSTO TOTAL DOS INGREDIENTES</td>
                  <td className="border border-gray-400 px-4 py-2 text-right text-lg">
                    R$ {totalCost.toFixed(2)}
                  </td>
                  <td className="border border-gray-400 px-4 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cronograma de Produção */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            CRONOGRAMA DE PRODUÇÃO
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">PREPARAÇÃO</h3>
              <div className="space-y-1 text-sm">
                <p>□ Separar todos os ingredientes</p>
                <p>□ Verificar equipamentos</p>
                <p>□ Organizar bancada</p>
                <p>□ Higienizar utensílios</p>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">PRODUÇÃO</h3>
              <div className="space-y-1 text-sm">
                <p>□ Seguir ordem das receitas</p>
                <p>□ Controlar temperaturas</p>
                <p>□ Verificar tempos</p>
                <p>□ Marcar receitas concluídas</p>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">FINALIZAÇÃO</h3>
              <div className="space-y-1 text-sm">
                <p>□ Embalar produtos</p>
                <p>□ Etiquetar com datas</p>
                <p>□ Armazenar adequadamente</p>
                <p>□ Limpar área de produção</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controle de Qualidade */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            CONTROLE DE QUALIDADE
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">DURANTE A PRODUÇÃO:</h3>
              <div className="space-y-1 text-sm">
                <p>□ Verificar peso dos ingredientes</p>
                <p>□ Controlar temperaturas de preparo</p>
                <p>□ Verificar tempos de mistura</p>
                <p>□ Controlar temperaturas de cocção</p>
                <p>□ Verificar ponto de cozimento</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">PRODUTO FINAL:</h3>
              <div className="space-y-1 text-sm">
                <p>□ Aparência geral</p>
                <p>□ Textura adequada</p>
                <p>□ Sabor conforme esperado</p>
                <p>□ Temperatura de armazenamento</p>
                <p>□ Embalagem e rotulagem</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-4 mt-8">
          <div className="grid grid-cols-4 gap-6 text-sm text-gray-600">
            <div>
              <p className="font-semibold">RESPONSÁVEL:</p>
              <p className="mt-2">_________________________</p>
            </div>
            <div>
              <p className="font-semibold">INÍCIO:</p>
              <p className="mt-2">_________________________</p>
            </div>
            <div>
              <p className="font-semibold">TÉRMINO:</p>
              <p className="mt-2">_________________________</p>
            </div>
            <div>
              <p className="font-semibold">APROVAÇÃO:</p>
              <p className="mt-2">_________________________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
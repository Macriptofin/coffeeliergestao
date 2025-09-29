import { forwardRef } from "react";

interface Material {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  subcategory?: string;
  usage_unit: string;
}

interface BOMProductionItem {
  bomId: string;
  quantity: number;
  multiplier: number;
}

interface BOMConsolidatedMaterial {
  material: Material;
  totalQuantity: number;
  totalCost: number;
  usedInBOMs: { bomName: string; quantity: number }[];
}

interface BOM {
  id: string;
  yield_quantity: number;
  yield_unit?: string;
  finished_material: Material;
}

interface PrintableBOMProductionOrderProps {
  orderName: string;
  orderDate: string;
  productionItems: BOMProductionItem[];
  consolidatedIngredients: BOMConsolidatedMaterial[];
  totalCost: number;
  boms?: BOM[];
}

export const PrintableBOMProductionOrder = forwardRef<HTMLDivElement, PrintableBOMProductionOrderProps>(
  ({ orderName, orderDate, productionItems, consolidatedIngredients, totalCost, boms = [] }, ref) => {
    return (
      <div ref={ref} className="print-recipe bg-white text-black p-4 max-w-full mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">ORDEM DE PRODUÇÃO BOM</h1>
          <h2 className="text-lg text-gray-600 mb-1">{orderName || 'Sem Nome'}</h2>
          <p className="text-sm text-gray-600">Data: {new Date(orderDate).toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 gap-4 mb-5 p-3 bg-gray-100 rounded text-sm page-break-inside-avoid">
          <div className="text-center">
            <h3 className="font-bold text-gray-700 mb-1">CUSTO TOTAL</h3>
            <p className="text-lg font-bold text-red-600">R$ {totalCost.toFixed(2)}</p>
          </div>
        </div>

        {/* Fichas Técnicas a Produzir */}
        <div className="mb-5 page-break-inside-avoid">
          <h2 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-400 pb-1">
            FICHAS TÉCNICAS A PRODUZIR
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-left font-bold">PRODUTO</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">CATEGORIA</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">QTD</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">MULT</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">TOTAL</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">OK</th>
                </tr>
              </thead>
              <tbody>
                {productionItems.map((productionItem, index) => {
                  const bom = boms.find(b => b.id === productionItem.bomId);
                  if (!bom) return null;
                  
                  const totalUnits = bom.yield_quantity * productionItem.quantity * productionItem.multiplier;
                  
                  return (
                    <tr key={productionItem.bomId} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-400 px-2 py-1 font-medium">{bom.finished_material.name}</td>
                      <td className="border border-gray-400 px-1 py-1 text-center">{bom.finished_material.category}</td>
                      <td className="border border-gray-400 px-1 py-1 text-center">{productionItem.quantity}</td>
                      <td className="border border-gray-400 px-1 py-1 text-center">{productionItem.multiplier}x</td>
                      <td className="border border-gray-400 px-1 py-1 text-center font-semibold">
                        {totalUnits} {bom.yield_unit || 'un'}
                      </td>
                      <td className="border border-gray-400 px-1 py-1 text-center">
                        <input type="checkbox" className="w-3 h-3" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista de Compras Consolidada */}
        <div className="mb-5 page-break-inside-avoid">
          <h2 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-400 pb-1">
            LISTA DE COMPRAS CONSOLIDADA
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-left font-bold">MATERIAL</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold">QTD TOTAL</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">UNI</th>
                  <th className="border border-gray-400 px-2 py-1 text-right font-bold">CUSTO</th>
                  <th className="border border-gray-400 px-1 py-1 text-center font-bold">OK</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedIngredients.map((item, index) => (
                  <tr key={item.material.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-400 px-2 py-1 font-medium">{item.material.name}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center font-semibold">
                      {item.totalQuantity.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-1 py-1 text-center">{item.material.usage_unit}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right font-semibold">
                      R$ {item.totalCost.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-1 py-1 text-center">
                      <input type="checkbox" className="w-3 h-3" />
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-400 px-2 py-1" colSpan={3}>CUSTO TOTAL DOS MATERIAIS</td>
                  <td className="border border-gray-400 px-2 py-1 text-right">
                    R$ {totalCost.toFixed(2)}
                  </td>
                  <td className="border border-gray-400 px-1 py-1"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cronograma de Produção */}
        <div className="mb-4 page-break-inside-avoid">
          <h2 className="text-lg font-bold text-gray-800 mb-2 border-b border-gray-400 pb-1">
            CRONOGRAMA DE PRODUÇÃO
          </h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-700 text-sm">PREPARAÇÃO</h3>
              <div className="space-y-0.5">
                <p>□ Separar materiais</p>
                <p>□ Verificar equipamentos</p>
                <p>□ Organizar bancada</p>
                <p>□ Higienizar utensílios</p>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-700 text-sm">PRODUÇÃO</h3>
              <div className="space-y-0.5">
                <p>□ Seguir ordem das BOMs</p>
                <p>□ Controlar quantidades</p>
                <p>□ Verificar qualidade</p>
                <p>□ Marcar produtos concluídos</p>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-700 text-sm">FINALIZAÇÃO</h3>
              <div className="space-y-0.5">
                <p>□ Embalar produtos</p>
                <p>□ Etiquetar com datas</p>
                <p>□ Armazenar adequadamente</p>
                <p>□ Limpar área de produção</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-2 mt-4">
          <div className="grid grid-cols-4 gap-3 text-xs text-gray-600">
            <div>
              <p className="font-semibold">RESPONSÁVEL:</p>
              <p className="mt-1">________________</p>
            </div>
            <div>
              <p className="font-semibold">INÍCIO:</p>
              <p className="mt-1">________________</p>
            </div>
            <div>
              <p className="font-semibold">TÉRMINO:</p>
              <p className="mt-1">________________</p>
            </div>
            <div>
              <p className="font-semibold">APROVAÇÃO:</p>
              <p className="mt-1">________________</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
import { forwardRef } from "react";

interface BOMItem {
  id: string;
  quantity: number;
  material: {
    id: string;
    name: string;
    usage_unit: string;
    average_price?: number;
  };
}

interface TechnicalSheetData {
  id: string;
  name: string;
  product_type: 'finished_product' | 'intermediate_product' | 'composite_product';
  category: string;
  subcategory?: string;
  material_code?: string;
  yield_quantity?: number;
  yield_unit?: string;
  items: BOMItem[];
}

interface PrintableTechnicalSheetProps {
  sheet: TechnicalSheetData;
}

export const PrintableTechnicalSheet = forwardRef<HTMLDivElement, PrintableTechnicalSheetProps>(
  ({ sheet }, ref) => {
    const totalCost = sheet.items.reduce((sum, item) => {
      const price = item.material.average_price || 0;
      return sum + (price * item.quantity);
    }, 0);

    const costPerUnit = sheet.yield_quantity && sheet.yield_quantity > 0 
      ? totalCost / sheet.yield_quantity 
      : totalCost;

    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'finished_product': return 'PRODUTO ACABADO';
        case 'intermediate_product': return 'PRODUTO INTERMEDIÁRIO';
        case 'composite_product': return 'PRODUTO COMPOSTO';
        default: return type.toUpperCase();
      }
    };

    return (
      <div ref={ref} className="print-recipe bg-white text-black p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{sheet.name}</h1>
          <p className="text-lg text-gray-600">FICHA TÉCNICA DE PRODUÇÃO</p>
          {sheet.material_code && (
            <p className="text-md text-gray-500 mt-1">Código: {sheet.material_code}</p>
          )}
        </div>

        {/* Informações Gerais */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
              INFORMAÇÕES GERAIS
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Tipo:</span>
                <span>{getTypeLabel(sheet.product_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Categoria:</span>
                <span>{sheet.category}</span>
              </div>
              {sheet.subcategory && (
                <div className="flex justify-between">
                  <span className="font-semibold">Subcategoria:</span>
                  <span>{sheet.subcategory}</span>
                </div>
              )}
              {sheet.yield_quantity && (
                <div className="flex justify-between">
                  <span className="font-semibold">Rendimento:</span>
                  <span>{sheet.yield_quantity} {sheet.yield_unit || 'un'}</span>
                </div>
              )}
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
              {sheet.yield_quantity && sheet.yield_quantity > 0 && (
                <div className="flex justify-between">
                  <span className="font-semibold">Custo por {sheet.yield_unit || 'un'}:</span>
                  <span className="font-bold">R$ {costPerUnit.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Materiais (BOM) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-400 pb-2">
            LISTA DE MATERIAIS (BOM)
          </h2>
          <div className="overflow-hidden">
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-4 py-2 text-left font-bold">MATERIAL</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">QUANTIDADE</th>
                  <th className="border border-gray-400 px-4 py-2 text-center font-bold">UNIDADE</th>
                  <th className="border border-gray-400 px-4 py-2 text-right font-bold">CUSTO UNIT. (R$)</th>
                  <th className="border border-gray-400 px-4 py-2 text-right font-bold">CUSTO TOTAL (R$)</th>
                </tr>
              </thead>
              <tbody>
                {sheet.items.map((item, index) => {
                  const unitPrice = item.material.average_price || 0;
                  const totalPrice = unitPrice * item.quantity;
                  
                  return (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-400 px-4 py-2 font-medium">{item.material.name}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{item.quantity}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center">{item.material.usage_unit}</td>
                      <td className="border border-gray-400 px-4 py-2 text-right">
                        {unitPrice.toFixed(4)}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-right font-semibold">
                        {totalPrice.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-400 px-4 py-2" colSpan={4}>CUSTO TOTAL</td>
                  <td className="border border-gray-400 px-4 py-2 text-right text-lg">
                    R$ {totalCost.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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
                  <p>□ Verificar qualidade dos materiais</p>
                  <p>□ Conferir quantidades conforme BOM</p>
                  <p>□ Verificar processo de produção</p>
                  <p>□ Controlar padrões de qualidade</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">ARMAZENAMENTO:</h3>
                <div className="space-y-1 text-gray-600">
                  <p>□ Condições adequadas de armazenamento</p>
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

PrintableTechnicalSheet.displayName = "PrintableTechnicalSheet";

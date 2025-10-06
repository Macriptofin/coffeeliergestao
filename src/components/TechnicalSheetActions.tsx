import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, FileDown, Eye } from "lucide-react";
import { PrintableTechnicalSheet } from "./PrintableTechnicalSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TechnicalSheetActionsProps {
  sheetId: string;
  sheetName: string;
  productType: 'finished_product' | 'intermediate_product' | 'composite_product';
}

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

export const TechnicalSheetActions = ({ sheetId, sheetName, productType }: TechnicalSheetActionsProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [sheetData, setSheetData] = useState<TechnicalSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSheetData = async () => {
    try {
      setLoading(true);
      
      if (productType === 'composite_product') {
        // Load composite BOM
        const { data, error } = await supabase
          .from('composites_bom')
          .select(`
            id,
            materials!composites_bom_composite_material_id_fkey(
              id,
              name,
              code,
              category,
              subcategory,
              material_type
            ),
            composite_bom_items(
              id,
              quantity,
              component_material:materials!composite_bom_items_component_material_id_fkey(
                id,
                name,
                usage_unit,
                average_price
              )
            )
          `)
          .eq('id', sheetId)
          .single();

        if (error) throw error;

        if (data) {
          setSheetData({
            id: data.id,
            name: data.materials?.name || 'Sem nome',
            product_type: productType,
            category: data.materials?.category || '',
            subcategory: data.materials?.subcategory,
            material_code: data.materials?.code,
            items: (data.composite_bom_items || []).map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              material: item.component_material
            }))
          });
        }
      } else {
        // Load recipe BOM
        const { data, error } = await supabase
          .from('recipes_bom')
          .select(`
            id,
            yield_quantity,
            yield_unit,
            materials!recipes_bom_finished_material_id_fkey(
              id,
              name,
              code,
              category,
              subcategory,
              material_type
            ),
            recipe_bom_items(
              id,
              quantity,
              ingredient_material:materials!recipe_bom_items_ingredient_material_id_fkey(
                id,
                name,
                usage_unit,
                average_price
              )
            )
          `)
          .eq('id', sheetId)
          .single();

        if (error) throw error;

        if (data) {
          setSheetData({
            id: data.id,
            name: data.materials?.name || 'Sem nome',
            product_type: productType,
            category: data.materials?.category || '',
            subcategory: data.materials?.subcategory,
            material_code: data.materials?.code,
            yield_quantity: data.yield_quantity,
            yield_unit: data.yield_unit,
            items: (data.recipe_bom_items || []).map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              material: item.ingredient_material
            }))
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ficha técnica:', error);
      toast.error('Erro ao carregar dados da ficha técnica');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheetData();
  }, [sheetId, productType]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ficha_Tecnica_${sheetName.replace(/\s+/g, '_')}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 1cm;
      }
      @media print {
        body {
          font-family: 'Times New Roman', serif;
          color: black !important;
          background: white !important;
        }
      }
    `,
  });

  const handleGeneratePDF = async () => {
    if (!printRef.current) return;

    try {
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "794px";
      tempContainer.style.backgroundColor = "white";
      document.body.appendChild(tempContainer);

      const clonedContent = printRef.current.cloneNode(true) as HTMLElement;
      tempContainer.appendChild(clonedContent);
      clonedContent.className = "print-recipe";
      
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123,
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Ficha_Tecnica_${sheetName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  if (loading || !sheetData) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          <Eye className="h-4 w-4 mr-1" />
          Carregando...
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4 no-print">
              <h3 className="text-lg font-semibold">Preview de Impressão</h3>
              <div className="flex gap-2">
                <Button onClick={handlePrint} size="sm">
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir
                </Button>
                <Button onClick={handleGeneratePDF} size="sm" variant="secondary">
                  <FileDown className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
            <PrintableTechnicalSheet ref={printRef} sheet={sheetData} />
          </div>
        </DialogContent>
      </Dialog>
      
      <Button onClick={handlePrint} size="sm" variant="secondary">
        <Printer className="h-4 w-4 mr-1" />
        Imprimir
      </Button>
      
      <Button onClick={handleGeneratePDF} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
        <FileDown className="h-4 w-4 mr-1" />
        PDF
      </Button>
    </div>
  );
};

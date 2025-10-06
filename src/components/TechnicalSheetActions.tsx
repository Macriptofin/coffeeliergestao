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
  notes?: string;
  items: BOMItem[];
}

export const TechnicalSheetActions = ({ sheetId, sheetName, productType }: TechnicalSheetActionsProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [sheetData, setSheetData] = useState<TechnicalSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSheetData = async () => {
    setLoading(true);
    try {
      if (productType === 'composite_product') {
        // Query without relational joins to avoid alias/FK issues
        const { data, error } = await supabase
          .from('composites_bom')
          .select(`
            id,
            composite_material_id,
            notes,
            composite_bom_items(
              id,
              quantity,
              component_material_id
            )
          `)
          .eq('id', sheetId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setSheetData(null);
          toast.error('Ficha técnica não encontrada');
          return;
        }

        const itemIds: string[] = (data.composite_bom_items || []).map((i: any) => i.component_material_id).filter(Boolean);
        const allMaterialIds = Array.from(new Set([data.composite_material_id, ...itemIds]));

        let materialsMap: Record<string, any> = {};
        if (allMaterialIds.length) {
          const { data: mats, error: matsErr } = await supabase
            .from('materials')
            .select(`
              id,
              name,
              code,
              category,
              subcategory,
              usage_unit,
              stock_items(average_price)
            `)
            .in('id', allMaterialIds);
          if (matsErr) throw matsErr;
          materialsMap = (mats || []).reduce((acc: any, m: any) => { 
            acc[m.id] = {
              ...m,
              average_price: m.stock_items?.[0]?.average_price || 0
            };
            return acc;
          }, {});
        }

        const compositeMaterial = materialsMap[data.composite_material_id] || {};

        setSheetData({
          id: data.id,
          name: compositeMaterial.name || 'Sem nome',
          product_type: productType,
          category: compositeMaterial.category || '',
          subcategory: compositeMaterial.subcategory,
          material_code: compositeMaterial.code,
          notes: data.notes,
          items: (data.composite_bom_items || []).map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            material: materialsMap[item.component_material_id] || { id: item.component_material_id, name: 'Material', usage_unit: 'un' }
          }))
        });
      } else {
        // Recipes (finished/intermediate) - no joins
        const { data, error } = await supabase
          .from('recipes_bom')
          .select(`
            id,
            yield_quantity,
            yield_unit,
            notes,
            finished_material_id,
            recipe_bom_items(
              id,
              quantity,
              material_id
            )
          `)
          .eq('id', sheetId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setSheetData(null);
          toast.error('Ficha técnica não encontrada');
          return;
        }

        const itemIds: string[] = (data.recipe_bom_items || []).map((i: any) => i.material_id).filter(Boolean);
        const allMaterialIds = Array.from(new Set([data.finished_material_id, ...itemIds]));

        let materialsMap: Record<string, any> = {};
        if (allMaterialIds.length) {
          const { data: mats, error: matsErr } = await supabase
            .from('materials')
            .select(`
              id,
              name,
              code,
              category,
              subcategory,
              usage_unit,
              stock_items(average_price)
            `)
            .in('id', allMaterialIds);
          if (matsErr) throw matsErr;
          materialsMap = (mats || []).reduce((acc: any, m: any) => { 
            acc[m.id] = {
              ...m,
              average_price: m.stock_items?.[0]?.average_price || 0
            };
            return acc;
          }, {});
        }

        const finishedMaterial = materialsMap[data.finished_material_id] || {};

        setSheetData({
          id: data.id,
          name: finishedMaterial.name || 'Sem nome',
          product_type: productType,
          category: finishedMaterial.category || '',
          subcategory: finishedMaterial.subcategory,
          material_code: finishedMaterial.code,
          yield_quantity: data.yield_quantity,
          yield_unit: data.yield_unit,
          notes: data.notes,
          items: (data.recipe_bom_items || []).map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            material: materialsMap[item.material_id] || { id: item.material_id, name: 'Material', usage_unit: 'un' }
          }))
        });
      }
    } catch (error) {
      console.error('Erro ao carregar ficha técnica (detalhes):', error);
      toast.error('Erro ao carregar dados da ficha técnica');
      setSheetData(null);
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
        .print-recipe {
          page-break-inside: avoid;
        }
        .print-recipe > div {
          page-break-inside: avoid;
        }
        table {
          page-break-inside: avoid;
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
      
      // Capturar com altura automática
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794,
        windowHeight: clonedContent.scrollHeight,
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Primeira página
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Adicionar páginas adicionais se necessário
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

  if (loading) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          <Eye className="h-4 w-4 mr-1" />
          Carregando...
        </Button>
      </div>
    );
  }

  if (!sheetData) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          <Eye className="h-4 w-4 mr-1" />
          Ficha não encontrada
        </Button>
        <Button variant="outline" size="sm" onClick={loadSheetData}>
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'none' }}>
        <PrintableTechnicalSheet ref={printRef} sheet={sheetData} />
      </div>
      <Button onClick={handlePrint} size="sm" variant="secondary">
        <Printer className="h-4 w-4 mr-1" />
        Imprimir
      </Button>
    </>
  );
};

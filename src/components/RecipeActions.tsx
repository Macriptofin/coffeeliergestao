import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { usePrintWithTitle } from "@/hooks/usePrintWithTitle";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Printer, FileDown, Eye } from "lucide-react";
import { PrintableRecipe } from "./PrintableRecipe";
import type { Recipe, Ingredient } from "@/types";

interface RecipeActionsProps {
  recipe: Recipe;
  ingredients: Ingredient[];
}

export const RecipeActions = ({ recipe, ingredients }: RecipeActionsProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = usePrintWithTitle({
    contentRef: printRef,
    documentTitle: `Ficha_Tecnica_${recipe.name.replace(/\s+/g, '_')}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 1cm;
      }
      @media print {
        body {
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          color: black !important;
          background: white !important;
        }
      }
    `,
  });

  const handleGeneratePDF = async () => {
    if (!printRef.current) return;

    try {
      // Create a temporary container for the PDF generation
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "794px"; // A4 width in pixels at 96 DPI
      tempContainer.style.backgroundColor = "white";
      document.body.appendChild(tempContainer);

      // Clone the content to the temporary container
      const clonedContent = printRef.current.cloneNode(true) as HTMLElement;
      tempContainer.appendChild(clonedContent);

      // Apply print styles
      clonedContent.className = "print-recipe";
      
      // Generate canvas from the temporary container
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123, // A4 height in pixels
      });

      // Remove temporary container
      document.body.removeChild(tempContainer);

      // Create PDF
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
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

      pdf.save(`Ficha_Tecnica_${recipe.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    }
  };

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
            <PrintableRecipe ref={printRef} recipe={recipe} ingredients={ingredients} />
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
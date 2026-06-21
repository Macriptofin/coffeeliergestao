import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, FileDown, Archive, ArchiveRestore, Tag, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Material } from "@/types";

interface MaterialsActionsProps {
  selectedCount: number;
  selectedMaterials: Material[];
  onBulkArchive: () => void;
  onBulkUnarchive: () => void;
  onClearSelection: () => void;
  onRefresh?: () => void;
}

export const MaterialsActions = ({
  selectedCount,
  selectedMaterials,
  onBulkArchive,
  onBulkUnarchive,
  onClearSelection,
  onRefresh
}: MaterialsActionsProps) => {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);

  const anyArchived = selectedMaterials.some(m => m.isArchived);
  const anyActive = selectedMaterials.some(m => !m.isArchived);
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleExport = () => {
    toast.info("Funcionalidade de exportação será implementada em breve");
  };

  const handleReclassify = () => {
    toast.info("Funcionalidade de reclassificação será implementada em breve");
  };

  const producedMaterials = selectedMaterials.filter(m => 
    m.materialType === 'intermediate_product' || m.materialType === 'finished_product'
  );

  const handleRecalculateCosts = async () => {
    if (producedMaterials.length === 0) {
      toast.error("Nenhum produto intermediário ou acabado selecionado");
      return;
    }

    setIsRecalculating(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (const material of producedMaterials) {
        const { data, error } = await supabase.rpc('recalculate_product_stock_cost', {
          p_material_id: material.id
        });

        if (error) {
          errorCount++;
          errors.push(`${material.name}: ${error.message}`);
        } else {
          const result = data as { success?: boolean; error?: string };
          if (result?.success === false) {
            errorCount++;
            errors.push(`${material.name}: ${result.error}`);
          } else {
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} ${successCount === 1 ? 'custo recalculado' : 'custos recalculados'} com sucesso!`);
        onRefresh?.();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} ${errorCount === 1 ? 'erro encontrado' : 'erros encontrados'}`, {
          description: errors.slice(0, 3).join('\n')
        });
      }

    } catch (error) {
      console.error("Erro ao recalcular custos:", error);
      toast.error("Erro ao recalcular custos");
    } finally {
      setIsRecalculating(false);
      setShowRecalculateDialog(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-4 p-4 bg-primary/5 border rounded-lg">
        <Badge variant="secondary" className="px-3 py-1">
          {selectedCount} {selectedCount === 1 ? 'material selecionado' : 'materiais selecionados'}
        </Badge>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Ações em Massa
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar Selecionados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReclassify}>
                <Tag className="h-4 w-4 mr-2" />
                Reclassificar Categoria
              </DropdownMenuItem>
              {producedMaterials.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowRecalculateDialog(true)}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Recalcular Custos ({producedMaterials.length})
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {anyActive && (
                <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar (desativar) Selecionados
                </DropdownMenuItem>
              )}
              {anyArchived && (
                <DropdownMenuItem onClick={() => setShowUnarchiveDialog(true)}>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Reativar Selecionados
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onClearSelection}>
            Limpar Seleção
          </Button>
        </div>
      </div>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Arquivamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar {selectedCount} {selectedCount === 1 ? 'material' : 'materiais'}? 
              Os materiais arquivados não aparecerão mais nas listagens principais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onBulkArchive();
                setShowArchiveDialog(false);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnarchiveDialog} onOpenChange={setShowUnarchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reativação</AlertDialogTitle>
            <AlertDialogDescription>
              Reativar {selectedCount} {selectedCount === 1 ? 'material' : 'materiais'}? Eles voltam a
              aparecer nas listagens, seleções e na ficha técnica. A sincronia leva a ficha técnica
              junto, se houver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkUnarchive();
                setShowUnarchiveDialog(false);
              }}
            >
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRecalculateDialog} onOpenChange={setShowRecalculateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalcular Custos no Estoque</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta operação irá recalcular o custo no estoque de {producedMaterials.length} {producedMaterials.length === 1 ? 'produto' : 'produtos'} 
                baseado em suas fichas técnicas (BOMs) atuais.
              </p>
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Produtos que serão recalculados:</p>
                <ul className="text-sm space-y-1">
                  {producedMaterials.slice(0, 5).map(m => (
                    <li key={m.id} className="text-muted-foreground">• {m.name}</li>
                  ))}
                  {producedMaterials.length > 5 && (
                    <li className="text-muted-foreground italic">... e mais {producedMaterials.length - 5}</li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ⚠️ Esta operação não afeta quantidades físicas em estoque, apenas recalcula custos.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRecalculating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRecalculateCosts}
              disabled={isRecalculating}
            >
              {isRecalculating ? 'Recalculando...' : 'Recalcular Custos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
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
import { MoreHorizontal, Trash2, FileDown, Archive, Tag } from "lucide-react";
import { toast } from "sonner";

interface MaterialsActionsProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export const MaterialsActions = ({ selectedCount, onBulkDelete, onClearSelection }: MaterialsActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleExport = () => {
    toast.info("Funcionalidade de exportação será implementada em breve");
  };

  const handleInactivate = () => {
    toast.info("Funcionalidade de inativação será implementada em breve");
  };

  const handleReclassify = () => {
    toast.info("Funcionalidade de reclassificação será implementada em breve");
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
              <DropdownMenuItem onClick={handleInactivate}>
                <Archive className="h-4 w-4 mr-2" />
                Inativar Selecionados
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Selecionados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onClearSelection}>
            Limpar Seleção
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedCount} {selectedCount === 1 ? 'material' : 'materiais'}? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onBulkDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
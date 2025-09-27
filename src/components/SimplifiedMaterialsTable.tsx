import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Tag, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Material } from "@/types";
import { getSubcategoryByValue } from "@/lib/material-categories";

interface SimplifiedMaterialsTableProps {
  materials: Material[];
  selectedMaterials: string[];
  onSelectMaterial: (materialId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

type SortField = 'name' | 'code' | 'category' | 'subcategory' | 'purchaseUnit' | 'usageUnit' | 'conversionFactor';
type SortDirection = 'asc' | 'desc';

export const SimplifiedMaterialsTable = ({ 
  materials, 
  selectedMaterials, 
  onSelectMaterial, 
  onSelectAll 
}: SimplifiedMaterialsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedMaterials = useMemo(() => {
    return [...materials].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      // Handle subcategory sorting
      if (sortField === 'subcategory') {
        aValue = aValue || '';
        bValue = bValue || '';
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [materials, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getCategoryIcon = (category: Material['category']) => {
    switch (category) {
      case 'Insumo':
      case 'Embalagem':
        return <Package className="h-4 w-4 mr-1" />;
      case 'Produto Acabado':
      case 'Produto Composto':
        return <Tag className="h-4 w-4 mr-1" />;
      default:
        return <Package className="h-4 w-4 mr-1" />;
    }
  };

  const getCategoryColor = (category: Material['category']) => {
    switch (category) {
      case 'Insumo': return 'blue';
      case 'Embalagem': return 'green';
      case 'Produto Acabado': return 'purple';
      case 'Produto Composto': return 'orange';
      default: return 'default';
    }
  };

  const allSelected = materials.length > 0 && selectedMaterials.length === materials.length;
  const someSelected = selectedMaterials.length > 0 && selectedMaterials.length < materials.length;

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum material encontrado</h3>
        <p className="text-muted-foreground">Ajuste os filtros ou adicione novos materiais</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                className={someSelected && !allSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('code')}
            >
              <div className="flex items-center gap-1">
                Código
                {getSortIcon('code')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                Nome
                {getSortIcon('name')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('category')}
            >
              <div className="flex items-center gap-1">
                Categoria
                {getSortIcon('category')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('subcategory')}
            >
              <div className="flex items-center gap-1">
                Subcategoria
                {getSortIcon('subcategory')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('purchaseUnit')}
            >
              <div className="flex items-center gap-1">
                Unid. Compra
                {getSortIcon('purchaseUnit')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('usageUnit')}
            >
              <div className="flex items-center gap-1">
                Unid. Uso
                {getSortIcon('usageUnit')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('conversionFactor')}
            >
              <div className="flex items-center gap-1">
                Fator Conv.
                {getSortIcon('conversionFactor')}
              </div>
            </TableHead>
            <TableHead>Quantidade Estoque</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMaterials.map((material) => (
            <TableRow key={material.id} className="hover:bg-muted/50">
              <TableCell>
                <Checkbox
                  checked={selectedMaterials.includes(material.id)}
                  onCheckedChange={(checked) => onSelectMaterial(material.id, !!checked)}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {material.code}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{material.name}</div>
                  {material.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {material.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={getCategoryColor(material.category) as any}
                  className="text-xs flex items-center w-fit"
                >
                  {getCategoryIcon(material.category)}
                  {material.category}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {material.subcategory ? (
                  <Badge variant="secondary" className="text-xs">
                    {getSubcategoryByValue(material.category, material.subcategory)?.label || material.subcategory}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground italic">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{material.purchaseUnit}</TableCell>
              <TableCell className="text-sm">{material.usageUnit}</TableCell>
              <TableCell className="text-sm font-mono">{material.conversionFactor}</TableCell>
              <TableCell className="text-sm">
                <span className="text-muted-foreground">0 {material.usageUnit}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
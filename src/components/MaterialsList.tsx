import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Package, Tag, Code, Wrench, Building } from "lucide-react";
import type { Material } from "@/types";
import { useTaxonomy } from "@/hooks/useConfig";

interface MaterialsListProps {
  materials: Material[];
  onEdit: (material: Material) => void;
  onDelete: (materialId: string) => void;
}

export const MaterialsList = ({ materials, onEdit, onDelete }: MaterialsListProps) => {
  const { terms, getTermsByTaxonomy } = useTaxonomy();
  
  const getSubcategoryName = (categoryName: string, subcategoryName?: string) => {
    if (!subcategoryName) return null;
    const categories = getTermsByTaxonomy('material_category');
    const category = categories.find(c => c.name === categoryName);
    if (!category) return subcategoryName;
    
    const subcategories = getTermsByTaxonomy('material_subcategory');
    const subcategory = subcategories.find(s => s.parent_id === category.id && s.name === subcategoryName);
    return subcategory?.name || subcategoryName;
  };

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum material cadastrado</h3>
        <p className="text-muted-foreground">Clique em "Novo Material" para começar</p>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    if (category?.toLowerCase().includes('embalagem')) return <Package className="h-4 w-4" />;
    if (category?.toLowerCase().includes('produto')) return <Tag className="h-4 w-4" />;
    if (category?.toLowerCase().includes('higiene')) return <Wrench className="h-4 w-4" />;
    if (category?.toLowerCase().includes('infraestrutura')) return <Building className="h-4 w-4" />;
    return <Package className="h-4 w-4" />;
  };

  const getCategoryColor = (category: string) => {
    if (category?.toLowerCase().includes('embalagem')) return 'secondary';
    if (category?.toLowerCase().includes('produto acabado')) return 'default';
    if (category?.toLowerCase().includes('produto composto')) return 'outline';
    return 'default';
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {materials.map((material) => (
        <Card key={material.id} className="shadow-soft hover:shadow-elegant transition-shadow border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2 flex items-start gap-2">
                  {getCategoryIcon(material.category)}
                  <span className="break-words leading-tight">{material.name}</span>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant={getCategoryColor(material.category) as any}
                    className="text-xs"
                  >
                    {material.category}
                  </Badge>
                  {material.subcategory && (
                    <Badge variant="secondary" className="text-xs">
                      {getSubcategoryName(material.category, material.subcategory) || material.subcategory}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    {material.code}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {material.description && (
              <div className="text-sm mb-3">
                <p className="text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm leading-relaxed line-clamp-3">{material.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Unidade de Uso</p>
                <p className="font-medium">{material.usageUnit}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unidade de Compra</p>
                <p className="font-medium">{material.purchaseUnit}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fator de Conversão:</span>
                <span className="font-medium">{material.conversionFactor}</span>
              </div>
            </div>

            {material.supplier && (
              <div className="text-sm">
                <p className="text-muted-foreground">Fornecedor</p>
                <p className="font-medium break-words">{material.supplier}</p>
              </div>
            )}

            {material.allowedBrands && material.allowedBrands.length > 0 && (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Marcas Permitidas</p>
                <div className="flex flex-wrap gap-1">
                  {material.allowedBrands.map((brand, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {brand}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(material)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onDelete(material.id)}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Package, Tag, Code } from "lucide-react";
import type { Material } from "@/pages/Materials";

interface MaterialsListProps {
  materials: Material[];
  onEdit: (material: Material) => void;
  onDelete: (materialId: string) => void;
}

export const MaterialsList = ({ materials, onEdit, onDelete }: MaterialsListProps) => {
  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum material cadastrado</h3>
        <p className="text-muted-foreground">Clique em "Novo Material" para começar</p>
      </div>
    );
  }

  const getCategoryIcon = (category: Material['category']) => {
    switch (category) {
      case 'Insumo':
        return <Package className="h-4 w-4" />;
      case 'Embalagem':
        return <Package className="h-4 w-4" />;
      case 'Produto Acabado':
        return <Tag className="h-4 w-4" />;
      case 'Produto Composto':
        return <Tag className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: Material['category']) => {
    switch (category) {
      case 'Insumo':
        return 'blue';
      case 'Embalagem':
        return 'green';
      case 'Produto Acabado':
        return 'purple';
      case 'Produto Composto':
        return 'orange';
      default:
        return 'default';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getPricePerUsageUnit = (pricePerPurchase: number, conversionFactor: number) => {
    return conversionFactor > 0 ? pricePerPurchase / conversionFactor : 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {materials.map((material) => (
        <Card key={material.id} className="shadow-soft hover:shadow-elegant transition-shadow border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg mb-2 flex items-center gap-2">
                  {getCategoryIcon(material.category)}
                  <span className="truncate">{material.name}</span>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant={getCategoryColor(material.category) as any}
                    className="text-xs"
                  >
                    {material.category}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    {material.code}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço por {material.purchaseUnit}:</span>
                <span className="font-bold text-primary">
                  {formatPrice(material.pricePerPurchaseUnit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo por {material.usageUnit}:</span>
                <span className="font-medium text-accent-coffee">
                  {formatPrice(getPricePerUsageUnit(material.pricePerPurchaseUnit, material.conversionFactor))}
                </span>
              </div>
            </div>

            {material.supplier && (
              <div className="text-sm">
                <p className="text-muted-foreground">Fornecedor</p>
                <p className="font-medium truncate">{material.supplier}</p>
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
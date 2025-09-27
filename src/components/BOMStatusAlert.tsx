import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BOMStatusAlertProps {
  hasBOM: boolean;
  cost?: number;
  itemsCount?: number;
  yieldQuantity?: number;
  materialType: 'finished_product' | 'composite_product';
}

export const BOMStatusAlert = ({ 
  hasBOM, 
  cost, 
  itemsCount, 
  yieldQuantity, 
  materialType 
}: BOMStatusAlertProps) => {
  if (!hasBOM) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>BOM não configurada</strong> → custo indisponível
          <br />
          <span className="text-sm">
            Configure a {materialType === 'finished_product' ? 'receita' : 'composição'} para calcular custos automaticamente
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <div className="flex items-center gap-2 mb-2">
          <strong>BOM configurada</strong>
          <Badge variant="outline" className="text-xs bg-white">
            {itemsCount} {itemsCount === 1 ? 'componente' : 'componentes'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Custo unitário:</span>
            <div className="font-medium text-green-700">R$ {cost?.toFixed(2) || '0,00'}</div>
          </div>
          {yieldQuantity && (
            <div>
              <span className="text-muted-foreground">Rendimento:</span>
              <div className="font-medium text-green-700">{yieldQuantity} unidades</div>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
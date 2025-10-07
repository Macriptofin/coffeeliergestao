import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle, Package, ShoppingCart } from 'lucide-react';

interface MissingItem {
  material_id: string;
  material_name: string;
  needed: number;
  available: number;
  missing: number;
  unit: string;
}

interface ProductionAvailabilityProps {
  available: boolean;
  missingItems: MissingItem[];
  onCreatePurchaseRequest?: () => void;
  loading?: boolean;
}

export const ProductionAvailability: React.FC<ProductionAvailabilityProps> = ({
  available,
  missingItems,
  onCreatePurchaseRequest,
  loading = false
}) => {
  const hasItems = missingItems.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>Disponibilidade de Itens</CardTitle>
          </div>
          {available ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Todos disponíveis
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {missingItems.length} item(ns) faltante(s)
            </Badge>
          )}
        </div>
        <CardDescription>
          {available 
            ? 'Todos os materiais estão disponíveis em estoque' 
            : 'Verifique os itens faltantes antes de iniciar a produção'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Verificando disponibilidade...
          </div>
        ) : !hasItems ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Estoque suficiente para produção
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Necessário</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingItems.map((item) => (
                  <TableRow key={item.material_id}>
                    <TableCell className="font-medium">
                      {item.material_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.needed.toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.available > 0 ? 'text-yellow-600' : 'text-red-600'}>
                        {item.available.toFixed(2)} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 font-semibold">
                        {item.missing.toFixed(2)} {item.unit}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {onCreatePurchaseRequest && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={onCreatePurchaseRequest} variant="outline">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Gerar Necessidades de Compra
                </Button>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Atenção</p>
                  <p>
                    A produção só pode ser <strong>iniciada</strong> quando todos os itens estiverem disponíveis.
                    Você pode salvar a ordem de produção agora e iniciá-la quando o estoque for reposto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

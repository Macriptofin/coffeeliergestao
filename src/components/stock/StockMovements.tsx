import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, ArrowUp, ArrowDown, Settings } from "lucide-react";

interface StockMovement {
  id: string;
  ingredient: {
    name: string;
    usageUnit: string;
  };
  movementType: 'Entrada' | 'Saida' | 'Ajuste';
  quantity: number;
  unitPrice?: number;
  referenceType?: 'Compra' | 'Producao' | 'Ajuste' | 'Perda';
  notes?: string;
  movementDate: string;
}

interface StockMovementsProps {
  onRefresh: () => void;
}

export function StockMovements({ onRefresh }: StockMovementsProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadMovements();
  }, [filter]);

  const loadMovements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          ingredients (
            name,
            usage_unit
          )
        `)
        .order('movement_date', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('movement_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedMovements: StockMovement[] = data.map(item => ({
        id: item.id,
        ingredient: {
          name: item.ingredients.name,
          usageUnit: item.ingredients.usage_unit
        },
        movementType: item.movement_type as 'Entrada' | 'Saida' | 'Ajuste',
        quantity: parseFloat(item.quantity?.toString() || '0'),
        unitPrice: item.unit_price ? parseFloat(item.unit_price?.toString() || '0') : undefined,
        referenceType: item.reference_type as 'Compra' | 'Producao' | 'Ajuste' | 'Perda' | undefined,
        notes: item.notes,
        movementDate: item.movement_date
      }));

      setMovements(formattedMovements);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
      toast.error('Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  };

  const getMovementIcon = (type: StockMovement['movementType']) => {
    switch (type) {
      case 'Entrada': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'Saida': return <ArrowDown className="h-4 w-4 text-red-600" />;
      case 'Ajuste': return <Settings className="h-4 w-4 text-blue-600" />;
    }
  };

  const getMovementColor = (type: StockMovement['movementType']) => {
    switch (type) {
      case 'Entrada': return 'default';
      case 'Saida': return 'secondary';
      case 'Ajuste': return 'outline';
    }
  };

  const getReferenceTypeLabel = (type?: StockMovement['referenceType']) => {
    switch (type) {
      case 'Compra': return 'Compra';
      case 'Producao': return 'Produção';
      case 'Ajuste': return 'Ajuste';
      case 'Perda': return 'Perda';
      default: return 'Outros';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Movimentações de Estoque
              </CardTitle>
              <CardDescription>
                Histórico completo de entradas, saídas e ajustes de estoque
              </CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as movimentações</SelectItem>
                <SelectItem value="Entrada">Apenas Entradas</SelectItem>
                <SelectItem value="Saida">Apenas Saídas</SelectItem>
                <SelectItem value="Ajuste">Apenas Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
              <p className="text-sm text-muted-foreground">
                {filter === 'all' 
                  ? 'Movimentações aparecerão aqui conforme o uso do sistema'
                  : `Nenhuma movimentação do tipo "${filter}" encontrada`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map(movement => (
                <div key={movement.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.movementType)}
                      <Badge variant={getMovementColor(movement.movementType)}>
                        {movement.movementType}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{movement.ingredient.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity.toFixed(2)} {movement.ingredient.usageUnit}
                        </span>
                        {movement.unitPrice && (
                          <span>R$ {movement.unitPrice.toFixed(4)}/un</span>
                        )}
                        <span className="text-primary">
                          {getReferenceTypeLabel(movement.referenceType)}
                        </span>
                      </div>
                      {movement.notes && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {movement.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>
                      {new Date(movement.movementDate).toLocaleDateString('pt-BR')}
                    </div>
                    <div>
                      {new Date(movement.movementDate).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
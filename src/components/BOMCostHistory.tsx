import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CostHistoryEntry {
  id: string;
  bom_type: 'recipe' | 'composite';
  bom_id: string;
  bom_name: string;
  old_total_cost: number;
  new_total_cost: number;
  cost_change_percent: number;
  cost_change_absolute: number;
  triggered_by_material_id: string;
  triggered_by_material_name: string;
  change_reason: string;
  created_at: string;
}

interface BOMCostHistoryProps {
  bomType?: 'recipe' | 'composite';
  bomId?: string;
}

export function BOMCostHistory({ bomType, bomId }: BOMCostHistoryProps) {
  const [history, setHistory] = useState<CostHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, [bomType, bomId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('vw_bom_cost_history_detailed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (bomType && bomId) {
        query = query
          .eq('bom_type', bomType)
          .eq('bom_id', bomId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory((data || []) as CostHistoryEntry[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico de custos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return <div className="text-muted-foreground">Carregando histórico...</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Custos
          </CardTitle>
          <CardDescription>
            Acompanhe as mudanças de custo ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma mudança de custo registrada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Custos
        </CardTitle>
        <CardDescription>
          Acompanhe as mudanças de custo ao longo do tempo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>BOM</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Custo Anterior</TableHead>
              <TableHead className="text-right">Custo Novo</TableHead>
              <TableHead className="text-right">Variação</TableHead>
              <TableHead>Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">
                  {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="font-medium">
                  {entry.bom_name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {entry.bom_type === 'recipe' ? 'Receita' : 'Composto'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(entry.old_total_cost || 0)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(entry.new_total_cost)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {entry.cost_change_percent > 0 ? (
                      <TrendingUp className="h-4 w-4 text-destructive" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-primary" />
                    )}
                    <span className={entry.cost_change_percent > 0 ? 'text-destructive' : 'text-primary'}>
                      {entry.cost_change_percent > 0 ? '+' : ''}
                      {entry.cost_change_percent?.toFixed(2)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.triggered_by_material_name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

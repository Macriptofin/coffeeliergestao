import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Play, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PlanningRun {
  id: string;
  run_code: string;
  run_date: string;
  planning_horizon_days: number;
  status: string;
  materials_analyzed: number;
  requirements_generated: number;
  total_value: number;
  completed_at?: string;
}

export function StockPlanning() {
  const [runs, setRuns] = useState<PlanningRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_planning_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRuns(data || []);
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de planejamento",
        variant: "destructive"
      });
    }
  };

  const runPlanning = async () => {
    setRunning(true);
    try {
      // Criar nova execução
      const { data: run, error: runError } = await supabase
        .from('stock_planning_runs')
        .insert({
          run_code: '',
          planning_horizon_days: 30,
          status: 'running'
        })
        .select()
        .single();

      if (runError) throw runError;

      // Buscar parâmetros ativos
      const { data: parameters, error: paramsError } = await supabase
        .from('stock_parameters')
        .select(`
          *,
          materials (
            id,
            name,
            usage_unit,
            price_per_purchase_unit
          )
        `)
        .eq('is_active', true);

      if (paramsError) throw paramsError;

      // Buscar estoque atual
      const materialIds = parameters?.map(p => p.material_id) || [];
      const { data: stocks, error: stockError } = await supabase
        .from('stock_items')
        .select('material_id, current_quantity')
        .in('material_id', materialIds);

      if (stockError) throw stockError;

      const stockMap = new Map(stocks?.map(s => [s.material_id, s.current_quantity]) || []);

      // Calcular necessidades
      const results = [];
      let requirementsGenerated = 0;
      let totalValue = 0;

      for (const param of parameters || []) {
        const currentStock = stockMap.get(param.material_id) || 0;
        
        // Verificar se está abaixo do ponto de pedido
        if (currentStock <= param.reorder_point) {
          const recommendedQuantity = param.maximum_stock - currentStock;
          const unitCost = param.materials?.price_per_purchase_unit || 0;
          const totalCost = recommendedQuantity * unitCost;

          results.push({
            planning_run_id: run.id,
            material_id: param.material_id,
            current_stock: currentStock,
            minimum_stock: param.minimum_stock,
            maximum_stock: param.maximum_stock,
            reorder_point: param.reorder_point,
            safety_stock: param.safety_stock,
            recommended_quantity: recommendedQuantity,
            abc_classification: param.abc_classification,
            priority_level: param.abc_classification === 'A' ? 'high' : param.abc_classification === 'B' ? 'normal' : 'low',
            unit: param.unit,
            unit_cost: unitCost,
            total_cost: totalCost
          });

          totalValue += totalCost;
          requirementsGenerated++;
        }
      }

      // Salvar resultados
      if (results.length > 0) {
        const { error: resultsError } = await supabase
          .from('stock_planning_results')
          .insert(results);

        if (resultsError) throw resultsError;
      }

      // Atualizar execução
      const { error: updateError } = await supabase
        .from('stock_planning_runs')
        .update({
          status: 'completed',
          materials_analyzed: parameters?.length || 0,
          requirements_generated: requirementsGenerated,
          total_value: totalValue,
          completed_at: new Date().toISOString()
        })
        .eq('id', run.id);

      if (updateError) throw updateError;

      toast({
        title: "Planejamento Concluído",
        description: `${requirementsGenerated} necessidades de compra identificadas`
      });

      loadRuns();
    } catch (error) {
      console.error('Erro ao executar planejamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível executar o planejamento de estoque",
        variant: "destructive"
      });
    } finally {
      setRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'running': return 'Executando';
      case 'failed': return 'Falhou';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Planejamento de Estoque</h3>
          <p className="text-sm text-muted-foreground">
            Execute análise ABC e gere requisições de compra baseadas em estoques mínimos
          </p>
        </div>
        <Button onClick={runPlanning} disabled={running}>
          <Play className="h-4 w-4 mr-2" />
          {running ? 'Executando...' : 'Executar Planejamento'}
        </Button>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Materiais</TableHead>
              <TableHead>Necessidades</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-mono">{run.run_code}</TableCell>
                <TableCell>{format(new Date(run.run_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(run.status)}>
                    {getStatusLabel(run.status)}
                  </Badge>
                </TableCell>
                <TableCell>{run.materials_analyzed}</TableCell>
                <TableCell>{run.requirements_generated}</TableCell>
                <TableCell>R$ {run.total_value?.toFixed(2) || '0.00'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
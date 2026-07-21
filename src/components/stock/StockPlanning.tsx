import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { todayLocalISO, addDaysLocalISO } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Play, Eye, Calendar, Package, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

// Tipos de material que fazem sentido ter política de compra. Produzidos sob
// demanda (intermediate_product/finished_product/composite_product — ex.: um
// sanduíche montado horas antes do evento, estoque sempre zerado) nunca viram
// necessidade de COMPRA — só os insumos comprados da ficha técnica deles podem
// (já resolvido na explosão via explode_event_requirements).
const PURCHASABLE_TYPES = ['ingredient', 'packaging', 'supply', 'resale_product', 'equipment'];

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

interface PlanningResultRow {
  id: string;
  material_id: string;
  material_name: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  reorder_point: number;
  safety_stock: number;
  recommended_quantity: number;
  abc_classification: string | null;
  priority_level: string;
  unit: string;
  unit_cost: number;
  total_cost: number;
  requirement_generated: boolean;
  requirement_id: string | null;
}

const EMPTY_RUNS: PlanningRun[] = [];
const EMPTY_RESULTS: PlanningResultRow[] = [];

async function fetchRuns(): Promise<PlanningRun[]> {
  const { data, error } = await supabase
    .from('stock_planning_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function fetchPlanningResults(runId: string): Promise<PlanningResultRow[]> {
  const { data, error } = await supabase
    .from('stock_planning_results')
    .select('*, materials(name)')
    .eq('planning_run_id', runId)
    .order('total_cost', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, material_name: r.materials?.name || '—' }));
}

export function StockPlanning() {
  const queryClient = useQueryClient();
  const [horizon, setHorizon] = useState(30);
  const [running, setRunning] = useState(false);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: runs = EMPTY_RUNS } = useQuery({ queryKey: ['stock-planning-runs'], queryFn: fetchRuns });

  const { data: runResults = EMPTY_RESULTS, isPending: loadingResults } = useQuery({
    queryKey: ['stock-planning-results', viewingRunId],
    queryFn: () => fetchPlanningResults(viewingRunId!),
    enabled: !!viewingRunId,
  });

  const refetchRuns = () => queryClient.invalidateQueries({ queryKey: ['stock-planning-runs'] });
  const refetchResults = () => queryClient.invalidateQueries({ queryKey: ['stock-planning-results', viewingRunId] });

  const runPlanning = async () => {
    setRunning(true);
    let runId: string | undefined;
    try {
      const { data: run, error: runError } = await supabase
        .from('stock_planning_runs')
        .insert({ run_code: '', planning_horizon_days: horizon, status: 'running' })
        .select()
        .single();
      if (runError) throw runError;
      runId = run.id;

      const today = todayLocalISO();
      const end = addDaysLocalISO(horizon);

      // 1. Parâmetros ativos — só tipos comprávels (defesa extra além do que já
      // é garantido na criação do parâmetro em StockParameters.tsx).
      const { data: parameters, error: paramsError } = await supabase
        .from('stock_parameters')
        .select('*, materials!inner(id, name, usage_unit, material_type, price_per_purchase_unit)')
        .eq('is_active', true)
        .in('materials.material_type', PURCHASABLE_TYPES);
      if (paramsError) throw paramsError;

      // 2. Eventos confirmados no horizonte
      const { data: events, error: eventsError } = await supabase
        .from('event_tables')
        .select('id, event_code, date_start')
        .gte('date_start', today)
        .lte('date_start', end)
        .neq('status', 'cancelado');
      if (eventsError) throw eventsError;

      // 3. Demanda de eventos já explodida até insumos comprávels
      const eventDemand: Record<string, { qty: number; unit: string; name: string; type: string }> = {};
      for (const event of events || []) {
        const { data: exploded, error: explodeError } = await (supabase.rpc as any)('explode_event_requirements', {
          p_event_table_id: event.id,
          p_explode_components: true,
        });
        if (explodeError) throw explodeError;
        (exploded || []).forEach((item: any) => {
          if (!PURCHASABLE_TYPES.includes(item.material_type)) return; // nunca produzido
          if (!eventDemand[item.material_id]) {
            eventDemand[item.material_id] = { qty: 0, unit: item.planned_unit, name: item.material_name, type: item.material_type };
          }
          eventDemand[item.material_id].qty += Number(item.planned_qty || 0);
        });
      }

      // 4. Estoque atual + preço médio — união dos materiais com parâmetro e com demanda de evento
      const paramByMaterial = Object.fromEntries((parameters || []).map((p: any) => [p.material_id, p]));
      const allMaterialIds = Array.from(new Set([...Object.keys(paramByMaterial), ...Object.keys(eventDemand)]));

      if (allMaterialIds.length === 0) {
        await supabase.from('stock_planning_runs').update({
          status: 'completed', materials_analyzed: 0, requirements_generated: 0, total_value: 0, completed_at: new Date().toISOString(),
        }).eq('id', runId);
        toast.success('Nenhum material com parâmetro ativo ou demanda de evento no horizonte.');
        refetchRuns();
        return;
      }

      const { data: stocks, error: stockError } = await supabase
        .from('stock_items')
        .select('material_id, current_quantity, average_price')
        .in('material_id', allMaterialIds);
      if (stockError) throw stockError;
      const stockMap = new Map((stocks || []).map((s: any) => [s.material_id, { qty: Number(s.current_quantity) || 0, avgPrice: Number(s.average_price) || 0 }]));

      // 5. Merge: estoque projetado = atual - demanda de evento no horizonte
      const results: any[] = [];
      for (const materialId of allMaterialIds) {
        const param: any = paramByMaterial[materialId];
        const demand = eventDemand[materialId]?.qty || 0;
        const stockInfo = stockMap.get(materialId) || { qty: 0, avgPrice: 0 };
        const currentStock = stockInfo.qty;
        const projectedStock = currentStock - demand;

        if (param) {
          if (projectedStock <= param.reorder_point) {
            const recommended = Math.max(0, param.maximum_stock - projectedStock);
            const unitCost = param.materials?.price_per_purchase_unit || stockInfo.avgPrice || 0;
            results.push({
              planning_run_id: runId,
              material_id: materialId,
              current_stock: currentStock,
              minimum_stock: param.minimum_stock,
              maximum_stock: param.maximum_stock,
              reorder_point: param.reorder_point,
              safety_stock: param.safety_stock,
              recommended_quantity: recommended,
              abc_classification: param.abc_classification,
              priority_level: param.abc_classification === 'A' ? 'high' : param.abc_classification === 'B' ? 'normal' : 'low',
              unit: param.unit,
              unit_cost: unitCost,
              total_cost: recommended * unitCost,
            });
          }
        } else if (demand > 0) {
          // Demanda de evento sem parâmetro configurado — linha virtual, sinalizada
          // na UI (abc_classification null nunca ocorre num parâmetro real, que
          // sempre nasce com 'N/A' — é o sinal de "sem parâmetro").
          results.push({
            planning_run_id: runId,
            material_id: materialId,
            current_stock: currentStock,
            minimum_stock: 0,
            maximum_stock: 0,
            reorder_point: 0,
            safety_stock: 0,
            recommended_quantity: Math.max(0, demand - currentStock),
            abc_classification: null,
            priority_level: 'normal',
            unit: eventDemand[materialId].unit,
            unit_cost: 0,
            total_cost: 0,
          });
        }
      }

      if (results.length > 0) {
        const { error: resultsError } = await supabase.from('stock_planning_results').insert(results);
        if (resultsError) throw resultsError;
      }

      const totalValue = results.reduce((sum, r) => sum + r.total_cost, 0);
      await supabase.from('stock_planning_runs').update({
        status: 'completed',
        materials_analyzed: allMaterialIds.length,
        requirements_generated: results.length,
        total_value: totalValue,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      toast.success(`${results.length} necessidades identificadas`);
      refetchRuns();
      setViewingRunId(runId);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao executar planejamento: ' + e.message);
      if (runId) {
        await supabase.from('stock_planning_runs').update({ status: 'failed' }).eq('id', runId);
        refetchRuns();
      }
    } finally {
      setRunning(false);
    }
  };

  const generateRequirements = async () => {
    const pending = runResults.filter(r => !r.requirement_generated && r.recommended_quantity > 0);
    if (pending.length === 0) {
      toast.info('Nada pendente pra gerar — todas as linhas já têm requisição ou não precisam de compra.');
      return;
    }
    setGenerating(true);
    try {
      // Reexecutar o planejamento antes de alguém tratar a requisição anterior
      // não pode duplicar — se já existe uma requisição aberta (pending/requested)
      // pro mesmo material, linka nela em vez de criar outra.
      const materialIds = pending.map(r => r.material_id);
      const { data: openReqs, error: openReqsError } = await supabase
        .from('purchase_requirements')
        .select('id, material_id')
        .in('material_id', materialIds)
        .in('status', ['pending', 'requested']);
      if (openReqsError) throw openReqsError;

      const openReqByMaterial = new Map((openReqs || []).map(r => [r.material_id, r.id]));
      const toLink = pending.filter(r => openReqByMaterial.has(r.material_id));
      const toCreate = pending.filter(r => !openReqByMaterial.has(r.material_id));

      let createdCount = 0;
      if (toCreate.length > 0) {
        const dueDate = addDaysLocalISO(7);
        const rows = toCreate.map(r => ({
          material_id: r.material_id,
          required_quantity: r.recommended_quantity,
          required_unit: r.unit,
          source_type: 'stock_planning',
          source_id: viewingRunId,
          priority: r.priority_level === 'high' ? 'high' : r.priority_level === 'low' ? 'low' : 'medium',
          status: 'pending',
          required_date: dueDate,
          notes: `Gerado pelo Planejamento de Estoque (${r.abc_classification ? 'classe ' + r.abc_classification : 'sem parâmetro ABC'})`,
        }));

        const { data: inserted, error } = await supabase.from('purchase_requirements').insert(rows).select('id');
        if (error) throw error;

        await Promise.all(toCreate.map((r, i) =>
          supabase.from('stock_planning_results')
            .update({ requirement_generated: true, requirement_id: inserted![i].id })
            .eq('id', r.id)
        ));
        createdCount = rows.length;
      }

      if (toLink.length > 0) {
        await Promise.all(toLink.map(r =>
          supabase.from('stock_planning_results')
            .update({ requirement_generated: true, requirement_id: openReqByMaterial.get(r.material_id) })
            .eq('id', r.id)
        ));
      }

      const linkedMsg = toLink.length > 0 ? ` (${toLink.length} já tinham requisição aberta, só vinculadas)` : '';
      toast.success(`${createdCount} requisições de compra criadas${linkedMsg}`);
      queryClient.invalidateQueries({ queryKey: ['purchase-requirements'] });
      refetchResults();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar requisições: ' + e.message);
    } finally {
      setGenerating(false);
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

  const priorityColor = (p: string) =>
    p === 'high' ? 'bg-red-100 text-red-700 border-red-200'
    : p === 'normal' ? 'bg-orange-100 text-orange-700 border-orange-200'
    : 'bg-blue-100 text-blue-700 border-blue-200';

  const pendingCount = runResults.filter(r => !r.requirement_generated && r.recommended_quantity > 0).length;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5 text-primary" />
            Planejamento de Estoque (ABC)
          </CardTitle>
          <CardDescription>
            Analisa estoque atual, ponto de pedido/classe ABC e demanda de eventos futuros pra apontar necessidades de compra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Horizonte:</span>
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  onClick={() => setHorizon(d)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    horizon === d ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button onClick={runPlanning} disabled={running} size="sm" className="ml-auto">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? 'Analisando...' : 'Executar Planejamento'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Horizonte</TableHead>
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
                <TableCell>{run.planning_horizon_days}d</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(run.status)}>{getStatusLabel(run.status)}</Badge>
                </TableCell>
                <TableCell>{run.materials_analyzed}</TableCell>
                <TableCell>{run.requirements_generated}</TableCell>
                <TableCell>R$ {run.total_value?.toFixed(2) || '0.00'}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setViewingRunId(run.id)} disabled={run.status !== 'completed'}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma execução ainda. Clique em "Executar Planejamento" pra começar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!viewingRunId} onOpenChange={(open) => !open && setViewingRunId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado do Planejamento</DialogTitle>
          </DialogHeader>
          {loadingResults ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : runResults.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Nenhuma necessidade identificada nesta execução.
            </div>
          ) : (
            <>
              <Separator />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {runResults.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${priorityColor(r.priority_level)}`}>{r.priority_level}</Badge>
                        {r.abc_classification ? (
                          <Badge variant="outline" className="text-xs">Classe {r.abc_classification}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Sem parâmetro ABC</Badge>
                        )}
                        <span className="font-medium truncate">{r.material_name}</span>
                        {r.requirement_generated && (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300">Requisição gerada</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        estoque: {r.current_stock.toFixed(2)} {r.unit}
                        {r.abc_classification && ` · ponto de pedido: ${r.reorder_point.toFixed(2)} · máximo: ${r.maximum_stock.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-semibold">{r.recommended_quantity.toFixed(2)} {r.unit}</p>
                      {r.total_cost > 0 && <p className="text-xs text-muted-foreground">R$ {r.total_cost.toFixed(2)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingRunId(null)}>Fechar</Button>
            <Button onClick={generateRequirements} disabled={generating || pendingCount === 0}>
              {generating
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Package className="h-4 w-4 mr-2" />
              }
              {pendingCount === 0 ? 'Nenhuma pendente' : `Gerar ${pendingCount} Requisições`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

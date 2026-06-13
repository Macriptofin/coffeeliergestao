import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, Save, Play, Lock, AlertCircle, Plus } from "lucide-react";
import { MaterialSelect } from "@/components/MaterialSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface InventoryCycle {
  id: string;
  name: string;
  status: string;
  notes?: string;
  created_at: string;
  started_at?: string;
  closed_at?: string;
  created_by?: string;
  closed_by?: string;
}

interface InventoryAdjustment {
  id: string;
  material_id: string;
  system_quantity: number;
  physical_quantity?: number;
  is_draft: boolean;
  adjustment_reason: string;
  // Dados do material
  material_name: string;
  material_code?: string;
  material_category: string;
  material_unit: string;
  // Campos calculados
  difference?: number;
  difference_value?: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  counting: "bg-blue-100 text-blue-800",
  reconciling: "bg-yellow-100 text-yellow-800",
  closed: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  counting: "Em Contagem",
  reconciling: "Em Reconciliação",
  closed: "Fechado",
};

const InventarioCiclo = () => {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<InventoryCycle | null>(null);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState(false);
  const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<string>("");
  const [addingMaterial, setAddingMaterial] = useState(false);

  useEffect(() => {
    if (cycleId) {
      loadCycleData();
    }
  }, [cycleId]);

  const loadCycleData = async () => {
    if (!cycleId) return;
    
    setLoading(true);
    try {
      // Carregar dados do ciclo
      const { data: cycleData, error: cycleError } = await supabase
        .from('inventory_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      if (cycleError) throw cycleError;
      setCycle(cycleData);

      // Carregar ajustes do ciclo
      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from('inventory_adjustments')
        .select('id, material_id, system_quantity, physical_quantity, is_draft, adjustment_reason')
        .eq('cycle_id', cycleId);

      if (adjustmentsError) throw adjustmentsError;

      // Carregar informações dos materiais separadamente
      const materialIds = (adjustmentsData || []).map(adj => adj.material_id);
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, code, category, usage_unit')
        .in('id', materialIds);

      if (materialsError) throw materialsError;

      // Criar mapa de materiais
      const materialsMap = new Map(
        (materialsData || []).map(m => [m.id, m])
      );

      // Transformar dados para a interface
      const formattedAdjustments: InventoryAdjustment[] = (adjustmentsData || []).map(adj => {
        const material = materialsMap.get(adj.material_id);
        return {
          id: adj.id,
          material_id: adj.material_id,
          system_quantity: adj.system_quantity,
          physical_quantity: adj.physical_quantity,
          is_draft: adj.is_draft,
          adjustment_reason: adj.adjustment_reason,
          material_name: material?.name || 'Material não encontrado',
          material_code: material?.code,
          material_category: material?.category || '',
          material_unit: material?.usage_unit || '',
          difference: adj.physical_quantity !== null ? adj.physical_quantity - adj.system_quantity : undefined,
        };
      });

      setAdjustments(formattedAdjustments);
    } catch (error) {
      console.error('Erro ao carregar dados do ciclo:', error);
      toast.error('Erro ao carregar dados do ciclo');
      navigate('/materiais/inventario-ajustes');
    } finally {
      setLoading(false);
    }
  };

  const updatePhysicalQuantity = (adjustmentId: string, quantity: number) => {
    setAdjustments(prev => prev.map(adj => {
      if (adj.id === adjustmentId) {
        const difference = quantity - adj.system_quantity;
        return {
          ...adj,
          physical_quantity: quantity,
          difference,
        };
      }
      return adj;
    }));
  };

  const saveAdjustments = async () => {
    setSaving(true);
    try {
      const updates = adjustments
        .filter(adj => adj.physical_quantity !== undefined)
        .map(adj => ({
          id: adj.id,
          physical_quantity: adj.physical_quantity,
        }));

      for (const update of updates) {
        const { error } = await supabase
          .from('inventory_adjustments')
          .update({ physical_quantity: update.physical_quantity })
          .eq('id', update.id);
        
        if (error) throw error;
      }

      toast.success('Quantidades salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar ajustes:', error);
      toast.error('Erro ao salvar ajustes');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.rpc('rpc_inventory_update_status', {
        p_cycle_id: cycleId,
        p_new_status: newStatus,
      });

      if (error) throw error;

      toast.success(`Status alterado para ${statusLabels[newStatus]}`);
      loadCycleData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do ciclo');
    }
  };

  const finalizeCycle = async () => {
    setFinalizing(true);
    try {
      // Verificar se todas as quantidades foram informadas
      const pendingItems = adjustments.filter(adj => adj.physical_quantity === null || adj.physical_quantity === undefined);
      
      if (pendingItems.length > 0) {
        toast.error(`${pendingItems.length} item(ns) ainda não possui(em) quantidade física informada`);
        setFinalizing(false);
        return;
      }

      const { data, error } = await supabase.rpc('rpc_inventory_finalize', {
        p_cycle_id: cycleId,
      });

      if (error) throw error;

      const result = data as { materials_affected?: number };
      toast.success(`Ciclo finalizado! ${result.materials_affected || 0} materiais ajustados.`);
      setShowConfirmDialog(false);
      loadCycleData();
    } catch (error) {
      console.error('Erro ao finalizar ciclo:', error);
      toast.error('Erro ao finalizar ciclo');
    } finally {
      setFinalizing(false);
    }
  };

  const addMaterialToCycle = async () => {
    if (!selectedMaterialToAdd) {
      toast.error('Selecione um material');
      return;
    }

    setAddingMaterial(true);
    try {
      const { data: addedCount, error } = await supabase.rpc('rpc_inventory_add_materials', {
        p_cycle_id: cycleId,
        p_material_ids: [selectedMaterialToAdd]
      });

      if (error) throw error;

      if (addedCount === 0) {
        toast.info('Material já existe neste ciclo');
      } else {
        toast.success('Material adicionado ao ciclo!');
        setShowAddMaterialDialog(false);
        setSelectedMaterialToAdd("");
        loadCycleData();
      }
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      toast.error('Erro ao adicionar material');
    } finally {
      setAddingMaterial(false);
    }
  };

  const printInventoryList = () => {
    if (adjustments.length === 0) {
      toast.error('Não há materiais para imprimir');
      return;
    }

    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const groupedByCategory = adjustments.reduce<Record<string, InventoryAdjustment[]>>((acc, adj) => {
      const cat = adj.material_category || 'Sem categoria';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(adj);
      return acc;
    }, {});

    const rows = Object.entries(groupedByCategory).map(([category, items]) => `
      <tr class="category-row">
        <td colspan="6"><strong>${category}</strong></td>
      </tr>
      ${items.map((adj, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          <td>${adj.material_code || '—'}</td>
          <td>${adj.material_name}</td>
          <td>${adj.material_unit}</td>
          <td class="number">${adj.system_quantity.toFixed(3)}</td>
          <td class="write-field"></td>
          <td class="write-field"></td>
        </tr>
      `).join('')}
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Lista de Inventário — ${cycle?.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #333; padding-bottom: 12px; }
    .header-left h1 { font-size: 16px; font-weight: bold; }
    .header-left p { font-size: 10px; color: #555; margin-top: 3px; }
    .header-right { text-align: right; font-size: 10px; color: #555; }
    .header-right strong { display: block; font-size: 13px; color: #111; }
    .meta { display: flex; gap: 32px; margin-bottom: 14px; font-size: 10px; }
    .meta span { color: #555; }
    .meta strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #222; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    th.number, td.number { text-align: right; }
    th.write-field { text-align: center; }
    td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
    tr.even { background: #f9f9f9; }
    tr.odd { background: #fff; }
    tr.category-row td { background: #ebebeb; font-size: 10px; padding: 4px 8px; letter-spacing: 0.3px; color: #333; border-bottom: none; }
    td.write-field { border: 1px solid #bbb; height: 22px; min-width: 80px; background: #fff; }
    .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 10px; }
    .sig-line { width: 220px; border-top: 1px solid #333; padding-top: 4px; text-align: center; color: #555; }
    .summary { margin-bottom: 14px; font-size: 10px; color: #555; }
    @media print {
      body { padding: 10px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>☕ Coffeelier — Lista de Inventário Físico</h1>
      <p>Preencha a coluna "Qtd. Física" com as quantidades encontradas. Não altere os demais campos.</p>
    </div>
    <div class="header-right">
      <strong>${cycle?.name}</strong>
      Emitido em: ${now}
    </div>
  </div>

  <div class="meta">
    <div><span>Total de itens: </span><strong>${adjustments.length}</strong></div>
    <div><span>Status: </span><strong>Rascunho / Em contagem</strong></div>
    ${cycle?.notes ? `<div><span>Obs: </span><strong>${cycle.notes}</strong></div>` : ''}
  </div>

  <div class="summary">Após a contagem, devolva esta lista ao responsável pelo lançamento no sistema.</div>

  <table>
    <thead>
      <tr>
        <th style="width:70px">Código</th>
        <th>Material</th>
        <th style="width:55px">Un.</th>
        <th class="number" style="width:90px">Qtd. Sistema</th>
        <th class="write-field" style="width:90px">Qtd. Física</th>
        <th class="write-field" style="width:80px">Observação</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <div class="sig-line">Responsável pela contagem</div>
    <div class="sig-line">Data da contagem: ____/____/________</div>
    <div class="sig-line">Conferido por</div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast.error('Permita pop-ups para imprimir a lista');
    }
  };

  const exportCSV = () => {
    if (adjustments.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    const headers = [
      'Código',
      'Material',
      'Categoria',
      'Unidade',
      'Qtd Sistema',
      'Qtd Física',
      'Diferença',
      'Status'
    ].join(';');

    const rows = adjustments.map(adj => [
      adj.material_code || '',
      adj.material_name,
      adj.material_category,
      adj.material_unit,
      adj.system_quantity.toFixed(2),
      adj.physical_quantity?.toFixed(2) || '',
      adj.difference?.toFixed(2) || '',
      adj.is_draft ? 'Pendente' : 'Aplicado'
    ].join(';'));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${cycle?.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const pendingCount = adjustments.filter(adj => adj.physical_quantity === null || adj.physical_quantity === undefined).length;
  const completedCount = adjustments.length - pendingCount;
  const hasChanges = adjustments.some(adj => adj.difference !== 0 && adj.difference !== undefined);

  if (loading || !cycle) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/materiais/inventario-ajustes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{cycle.name}</h1>
          <p className="text-muted-foreground">
            Criado em {formatDate(cycle.created_at)}
          </p>
        </div>
        <Badge className={statusColors[cycle.status]}>
          {statusLabels[cycle.status]}
        </Badge>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{adjustments.length}</div>
            <p className="text-xs text-muted-foreground">Total de Materiais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Quantidades Informadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {adjustments.filter(adj => adj.difference !== 0 && adj.difference !== undefined).length}
            </div>
            <p className="text-xs text-muted-foreground">Com Diferenças</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {cycle.status === 'draft' && adjustments.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ciclo vazio</AlertTitle>
          <AlertDescription>
            Este ciclo ainda não possui materiais. Use o relatório de "Itens Zerados" para adicionar materiais que precisam de contagem.
          </AlertDescription>
        </Alert>
      )}

      {hasChanges && cycle.status === 'counting' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Diferenças encontradas</AlertTitle>
          <AlertDescription>
            Foram encontradas diferenças entre as quantidades do sistema e físicas. Revise antes de finalizar o ciclo.
          </AlertDescription>
        </Alert>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {cycle.status === 'draft' && (
          <Dialog open={showAddMaterialDialog} onOpenChange={setShowAddMaterialDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Material ao Ciclo</DialogTitle>
                <DialogDescription>
                  Selecione um material para adicionar a este ciclo de inventário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Material</label>
                  <MaterialSelect
                    value={selectedMaterialToAdd}
                    onValueChange={setSelectedMaterialToAdd}
                    placeholder="Selecione um material"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddMaterialDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={addMaterialToCycle} disabled={addingMaterial || !selectedMaterialToAdd}>
                  {addingMaterial ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        <Button variant="outline" onClick={printInventoryList}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Lista
        </Button>

        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
        
        {cycle.status === 'draft' && (
          <Button onClick={() => changeStatus('counting')}>
            <Play className="h-4 w-4 mr-2" />
            Iniciar Contagem
          </Button>
        )}
        
        {cycle.status === 'counting' && (
          <>
            <Button onClick={saveAdjustments} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Quantidades'}
            </Button>
            
            {pendingCount === 0 && (
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Lock className="h-4 w-4 mr-2" />
                    Finalizar Ciclo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Finalização do Ciclo</DialogTitle>
                    <DialogDescription>
                      Esta ação irá aplicar todos os ajustes ao estoque e fechar o ciclo. 
                      Não será possível alterar as quantidades após a finalização.
                      
                      {hasChanges && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <strong>Atenção:</strong> Foram identificadas diferenças que serão aplicadas ao estoque.
                        </div>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={finalizeCycle} disabled={finalizing}>
                      {finalizing ? 'Finalizando...' : 'Confirmar Finalização'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </div>

      {/* Tabela de ajustes */}
      {adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materiais do Ciclo</CardTitle>
            <CardDescription>
              Compare as quantidades do sistema com as quantidades físicas contadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Qtd Sistema</TableHead>
                    <TableHead className="text-right">Qtd Física</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell className="font-mono text-sm">
                        {adj.material_code || 'S/C'}
                      </TableCell>
                      <TableCell className="font-medium">{adj.material_name}</TableCell>
                      <TableCell>{adj.material_category}</TableCell>
                      <TableCell className="text-right">
                        {adj.system_quantity.toFixed(2)} {adj.material_unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {cycle.status === 'counting' ? (
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24 text-right"
                            value={adj.physical_quantity || ''}
                            onChange={(e) => updatePhysicalQuantity(adj.id, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        ) : (
                          <span>
                            {adj.physical_quantity?.toFixed(2) || '-'} {adj.material_unit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {adj.difference !== undefined ? (
                          <Badge 
                            variant={adj.difference === 0 ? "secondary" : "destructive"}
                            className={adj.difference > 0 ? "bg-green-100 text-green-800" : undefined}
                          >
                            {adj.difference > 0 ? '+' : ''}{adj.difference.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={adj.physical_quantity !== null && adj.physical_quantity !== undefined ? "default" : "secondary"}
                        >
                          {adj.physical_quantity !== null && adj.physical_quantity !== undefined ? 'Informado' : 'Pendente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InventarioCiclo;
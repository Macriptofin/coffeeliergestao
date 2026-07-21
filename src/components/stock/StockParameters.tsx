import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Save, X, Plus, Sparkles } from "lucide-react";

// Tipos de material que fazem sentido ter política de compra (mínimo/máximo/ponto
// de pedido). Produzidos sob demanda (intermediate_product/finished_product/
// composite_product) nunca entram aqui — não são comprados, são feitos na hora.
const PURCHASABLE_TYPES = ['ingredient', 'packaging', 'supply', 'resale_product', 'equipment'];

interface StockParameter {
  id: string;
  material_id: string;
  material_name: string;
  abc_classification: string;
  minimum_stock: number;
  maximum_stock: number;
  reorder_point: number;
  safety_stock: number;
  lead_time_days: number;
  review_period_days: number;
  unit: string;
  is_active: boolean;
  notes?: string;
}

interface MaterialOption {
  id: string;
  name: string;
  code: string;
  usage_unit: string;
}

interface AbcSuggestion {
  material_id: string;
  material_name: string;
  usage_unit: string;
  consumption_value: number;
  cumulative_pct: number;
  suggested_classification: string;
  avg_daily_consumption: number;
  suggested_reorder_point: number;
  suggested_maximum_stock: number;
}

const EMPTY_PARAMETERS: StockParameter[] = [];

async function fetchStockParameters(): Promise<StockParameter[]> {
  const { data: params, error } = await supabase
    .from('stock_parameters')
    .select(`
      *,
      materials (
        name
      )
    `)
    .order('abc_classification', { ascending: true });

  if (error) throw error;

  return params?.map(p => ({
    ...p,
    material_name: p.materials?.name || 'N/A'
  })) || [];
}

const NEW_PARAM_DEFAULTS = {
  material_id: '',
  abc_classification: 'N/A',
  minimum_stock: 0,
  maximum_stock: 0,
  reorder_point: 0,
  safety_stock: 0,
  lead_time_days: 7,
  review_period_days: 7,
};

export function StockParameters() {
  const queryClient = useQueryClient();

  const {
    data: parameters = EMPTY_PARAMETERS,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['stock-parameters'], queryFn: fetchStockParameters });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockParameter>>({});

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [newParam, setNewParam] = useState<typeof NEW_PARAM_DEFAULTS>(NEW_PARAM_DEFAULTS);
  const [saving, setSaving] = useState(false);

  const [showAbcDialog, setShowAbcDialog] = useState(false);
  const [abcSuggestions, setAbcSuggestions] = useState<AbcSuggestion[]>([]);
  const [loadingAbc, setLoadingAbc] = useState(false);
  const [applyingAbc, setApplyingAbc] = useState(false);

  useEffect(() => {
    if (isError) {
      toast.error('Não foi possível carregar os parâmetros de estoque');
    }
  }, [isError]);

  const refetchParameters = () => queryClient.invalidateQueries({ queryKey: ['stock-parameters'] });

  const startEdit = (param: StockParameter) => {
    setEditingId(param.id);
    setEditForm(param);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('stock_parameters')
        .update({
          abc_classification: editForm.abc_classification,
          minimum_stock: editForm.minimum_stock,
          maximum_stock: editForm.maximum_stock,
          reorder_point: editForm.reorder_point,
          safety_stock: editForm.safety_stock,
          lead_time_days: editForm.lead_time_days,
          review_period_days: editForm.review_period_days,
          is_active: editForm.is_active,
          notes: editForm.notes
        })
        .eq('id', editingId);

      if (error) throw error;

      toast.success('Parâmetros atualizados com sucesso');
      refetchParameters();
      cancelEdit();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Não foi possível salvar os parâmetros');
    }
  };

  // ─── Novo Parâmetro ─────────────────────────────────────────────────────
  const openNewDialog = async () => {
    setNewParam(NEW_PARAM_DEFAULTS);
    setShowNewDialog(true);
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, code, usage_unit')
      .in('material_type', PURCHASABLE_TYPES)
      .eq('is_archived', false)
      .order('name');
    if (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
      return;
    }
    const existingIds = new Set(parameters.map(p => p.material_id));
    setMaterialOptions((data || []).filter(m => !existingIds.has(m.id)));
  };

  const selectedMaterial = materialOptions.find(m => m.id === newParam.material_id);

  const handleCreateParam = async () => {
    if (!newParam.material_id) {
      toast.error('Selecione um material');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('stock_parameters').insert({
        material_id: newParam.material_id,
        abc_classification: newParam.abc_classification,
        minimum_stock: newParam.minimum_stock,
        maximum_stock: newParam.maximum_stock,
        reorder_point: newParam.reorder_point,
        safety_stock: newParam.safety_stock,
        lead_time_days: newParam.lead_time_days,
        review_period_days: newParam.review_period_days,
        unit: selectedMaterial?.usage_unit || 'un',
        is_active: true,
      });
      if (error) throw error;

      toast.success('Parâmetro criado com sucesso');
      setShowNewDialog(false);
      refetchParameters();
    } catch (error) {
      console.error('Erro ao criar parâmetro:', error);
      toast.error('Erro ao criar parâmetro');
    } finally {
      setSaving(false);
    }
  };

  // ─── Sugestão de Classificação ABC ──────────────────────────────────────
  const openAbcSuggestions = async () => {
    setShowAbcDialog(true);
    setLoadingAbc(true);
    try {
      const { data, error } = await (supabase.rpc as any)('suggest_abc_classification', { p_lookback_days: 180 });
      if (error) throw error;
      setAbcSuggestions(data || []);
    } catch (error) {
      console.error('Erro ao sugerir classificação ABC:', error);
      toast.error('Erro ao calcular sugestão de classificação ABC');
    } finally {
      setLoadingAbc(false);
    }
  };

  const applyAbcSuggestions = async () => {
    if (abcSuggestions.length === 0) return;
    setApplyingAbc(true);
    try {
      const { error } = await supabase.from('stock_parameters').upsert(
        abcSuggestions.map(s => ({
          material_id: s.material_id,
          abc_classification: s.suggested_classification,
          reorder_point: s.suggested_reorder_point,
          maximum_stock: s.suggested_maximum_stock,
          minimum_stock: s.suggested_reorder_point,
          safety_stock: 0,
          lead_time_days: 7,
          review_period_days: 7,
          unit: s.usage_unit,
          is_active: true,
        })),
        { onConflict: 'material_id' }
      );
      if (error) throw error;

      toast.success(`Classificação ABC aplicada a ${abcSuggestions.length} materiais — revise mínimo/máximo antes de confiar de olhos fechados.`);
      setShowAbcDialog(false);
      refetchParameters();
    } catch (error) {
      console.error('Erro ao aplicar classificação ABC:', error);
      toast.error('Erro ao aplicar classificação ABC');
    } finally {
      setApplyingAbc(false);
    }
  };

  const getClassColor = (classification: string) => {
    switch (classification) {
      case 'A': return 'text-red-600 font-bold';
      case 'B': return 'text-yellow-600 font-semibold';
      case 'C': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={openAbcSuggestions}>
          <Sparkles className="h-4 w-4 mr-2" />
          Sugerir Classificação ABC
        </Button>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Parâmetro
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>ABC</TableHead>
              <TableHead>Estoque Mín.</TableHead>
              <TableHead>Estoque Máx.</TableHead>
              <TableHead>Ponto Pedido</TableHead>
              <TableHead>Estoque Seg.</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhum parâmetro configurado ainda. Use "Sugerir Classificação ABC" pra começar a partir do histórico de consumo, ou "Novo Parâmetro" pra configurar manualmente.
                </TableCell>
              </TableRow>
            )}
            {parameters.map((param) => (
              <TableRow key={param.id}>
                {editingId === param.id ? (
                  <>
                    <TableCell>{param.material_name}</TableCell>
                    <TableCell>
                      <Select
                        value={editForm.abc_classification}
                        onValueChange={(value) => setEditForm({ ...editForm, abc_classification: value })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.minimum_stock}
                        onChange={(e) => setEditForm({ ...editForm, minimum_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.maximum_stock}
                        onChange={(e) => setEditForm({ ...editForm, maximum_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.reorder_point}
                        onChange={(e) => setEditForm({ ...editForm, reorder_point: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.safety_stock}
                        onChange={(e) => setEditForm({ ...editForm, safety_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.lead_time_days}
                        onChange={(e) => setEditForm({ ...editForm, lead_time_days: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editForm.is_active ? 'active' : 'inactive'}
                        onValueChange={(value) => setEditForm({ ...editForm, is_active: value === 'active' })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={saveEdit}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{param.material_name}</TableCell>
                    <TableCell>
                      <span className={getClassColor(param.abc_classification)}>
                        {param.abc_classification}
                      </span>
                    </TableCell>
                    <TableCell>{param.minimum_stock} {param.unit}</TableCell>
                    <TableCell>{param.maximum_stock} {param.unit}</TableCell>
                    <TableCell>{param.reorder_point} {param.unit}</TableCell>
                    <TableCell>{param.safety_stock} {param.unit}</TableCell>
                    <TableCell>{param.lead_time_days} dias</TableCell>
                    <TableCell>
                      <span className={param.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                        {param.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(param)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Novo Parâmetro */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Parâmetro de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Material *</Label>
              <Combobox
                options={materialOptions.map(m => ({ value: m.id, label: m.name, searchText: `${m.name} ${m.code}` }))}
                value={newParam.material_id}
                placeholder="Selecionar material..."
                searchPlaceholder="Buscar material..."
                emptyText="Nenhum material disponível (só insumos/embalagens/materiais de consumo/revenda/equipamentos comprados que ainda não têm parâmetro)."
                onSelect={(v) => setNewParam({ ...newParam, material_id: v })}
              />
              {selectedMaterial && (
                <p className="text-xs text-muted-foreground">Unidade: {selectedMaterial.usage_unit}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classificação ABC</Label>
                <Select value={newParam.abc_classification} onValueChange={(v) => setNewParam({ ...newParam, abc_classification: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead Time (dias)</Label>
                <NumericInput
                  value={newParam.lead_time_days}
                  onChange={(e) => setNewParam({ ...newParam, lead_time_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque Mínimo</Label>
                <NumericInput
                  step="0.01"
                  value={newParam.minimum_stock}
                  onChange={(e) => setNewParam({ ...newParam, minimum_stock: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque Máximo</Label>
                <NumericInput
                  step="0.01"
                  value={newParam.maximum_stock}
                  onChange={(e) => setNewParam({ ...newParam, maximum_stock: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ponto de Pedido</Label>
                <NumericInput
                  step="0.01"
                  value={newParam.reorder_point}
                  onChange={(e) => setNewParam({ ...newParam, reorder_point: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque de Segurança</Label>
                <NumericInput
                  step="0.01"
                  value={newParam.safety_stock}
                  onChange={(e) => setNewParam({ ...newParam, safety_stock: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateParam} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Parâmetro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugestão de Classificação ABC */}
      <Dialog open={showAbcDialog} onOpenChange={setShowAbcDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestão de Classificação ABC</DialogTitle>
          </DialogHeader>
          {loadingAbc ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Calculando pelo histórico de consumo (últimos 180 dias)...</p>
          ) : abcSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum material com consumo (saída de estoque) suficiente nos últimos 180 dias pra sugerir classificação.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Baseado no valor de consumo real dos últimos 180 dias — curva de Pareto (A = até 80% do valor acumulado, B = até 95%, C = resto).
                Só materiais com consumo registrado; os demais continuam sem parâmetro. <strong>Revise ponto de pedido e máximo antes de confiar de olhos fechados</strong> — são estimativas a partir do consumo médio diário × 7 dias de lead time (padrão).
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Valor Consumo</TableHead>
                    <TableHead>% Acumulado</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Ponto Pedido (sugerido)</TableHead>
                    <TableHead>Máximo (sugerido)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abcSuggestions.map(s => (
                    <TableRow key={s.material_id}>
                      <TableCell>{s.material_name}</TableCell>
                      <TableCell>R$ {Number(s.consumption_value).toFixed(2)}</TableCell>
                      <TableCell>{Number(s.cumulative_pct).toFixed(1)}%</TableCell>
                      <TableCell><span className={getClassColor(s.suggested_classification)}>{s.suggested_classification}</span></TableCell>
                      <TableCell>{Number(s.suggested_reorder_point).toFixed(2)}</TableCell>
                      <TableCell>{Number(s.suggested_maximum_stock).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbcDialog(false)}>Cancelar</Button>
            <Button onClick={applyAbcSuggestions} disabled={applyingAbc || abcSuggestions.length === 0}>
              {applyingAbc ? 'Aplicando...' : `Aplicar a ${abcSuggestions.length} materiais`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from '@/components/ui/select';
import { CheckCircle, Plus, Trash2, AlertTriangle, TrendingDown } from 'lucide-react';
import { NumericInput } from '@/components/ui/numeric-input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BOMItem {
  id: string;
  bom_id: string;
  quantity: number;
  multiplier: number;
  total_yield_quantity: number;
  yield_unit: string;
  bom: {
    id: string;
    finished_material: {
      id: string;
      name: string;
      code: string;
      category: string;
    };
  };
}

interface ConsolidatedMaterial {
  id: string;
  material_id: string;
  total_quantity: number;
  unit: string;
  material: {
    id: string;
    name: string;
    code: string;
    usage_unit: string;
  };
}

interface ProductionOrder {
  id: string;
  order_name: string;
  items: BOMItem[];
  consolidated_materials: ConsolidatedMaterial[];
}

interface YieldEntry {
  bom_item_id: string;
  actual_yield_quantity: string;
  notes: string;
}

interface LossEntry {
  material_id: string;
  loss_quantity: string;
  loss_unit: string;
  loss_reason: string;
  notes: string;
}

interface Props {
  order: ProductionOrder;
  open: boolean;
  onClose: () => void;
  onFinalized: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOSS_REASONS = [
  { value: 'quebra', label: 'Quebra / Dano físico' },
  { value: 'deterioração', label: 'Deterioração' },
  { value: 'processo', label: 'Perda de processo (normal)' },
  { value: 'acidente', label: 'Acidente' },
  { value: 'outro', label: 'Outro' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductionFinalizationDialog({ order, open, onClose, onFinalized }: Props) {
  // Yield state — one entry per BOM item, pre-filled with planned quantity
  const [yields, setYields] = useState<YieldEntry[]>(() =>
    order.items.map(item => ({
      bom_item_id: item.id,
      actual_yield_quantity: String(item.total_yield_quantity),
      notes: '',
    }))
  );

  // Losses state — starts empty
  const [losses, setLosses] = useState<LossEntry[]>([]);

  const [saving, setSaving] = useState(false);

  // Opções de perda: PRODUTOS produzidos (receita pronta) + INGREDIENTES consumidos.
  // Permite justificar perda tanto no acabado/intermediário quanto no ingrediente.
  const lossOptionsMap = new Map<string, { id: string; name: string; unit: string; group: 'produto' | 'ingrediente' }>();
  order.items.forEach(i => {
    const fm = i.bom?.finished_material;
    if (fm && !lossOptionsMap.has(fm.id)) {
      lossOptionsMap.set(fm.id, { id: fm.id, name: fm.name, unit: i.yield_unit, group: 'produto' });
    }
  });
  order.consolidated_materials.forEach(m => {
    if (!lossOptionsMap.has(m.material_id)) {
      lossOptionsMap.set(m.material_id, { id: m.material_id, name: m.material.name, unit: m.unit, group: 'ingrediente' });
    }
  });
  const lossProdutos = [...lossOptionsMap.values()].filter(o => o.group === 'produto');
  const lossIngredientes = [...lossOptionsMap.values()].filter(o => o.group === 'ingrediente');

  // --- Yield handlers ---
  const updateYield = (index: number, field: keyof YieldEntry, value: string) => {
    setYields(prev => prev.map((y, i) => i === index ? { ...y, [field]: value } : y));
  };

  // --- Loss handlers ---
  const addLoss = () => {
    const first = lossProdutos[0] || lossIngredientes[0];
    setLosses(prev => [...prev, {
      material_id: first?.id || '',
      loss_quantity: '',
      loss_unit: first?.unit || 'g',
      loss_reason: 'processo',
      notes: '',
    }]);
  };

  const updateLoss = (index: number, field: keyof LossEntry, value: string) => {
    setLosses(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const updated = { ...l, [field]: value };
      // Auto-fill unit when material changes
      if (field === 'material_id') {
        const opt = lossOptionsMap.get(value);
        if (opt) updated.loss_unit = opt.unit;
      }
      return updated;
    }));
  };

  const removeLoss = (index: number) => {
    setLosses(prev => prev.filter((_, i) => i !== index));
  };

  // --- Submit ---
  const handleConfirm = async () => {
    // Validate yields
    for (const y of yields) {
      const qty = parseFloat(y.actual_yield_quantity);
      if (isNaN(qty) || qty < 0) {
        toast.error('Informe quantidades válidas (≥ 0) para todos os rendimentos');
        return;
      }
    }

    // Validate losses
    for (const l of losses) {
      if (!l.material_id) { toast.error('Selecione o ingrediente para cada perda'); return; }
      const qty = parseFloat(l.loss_quantity);
      if (isNaN(qty) || qty <= 0) { toast.error('Informe uma quantidade válida para cada perda'); return; }
    }

    setSaving(true);
    try {
      const itemsPayload = yields.map(y => ({
        bom_item_id: y.bom_item_id,
        actual_yield_quantity: parseFloat(y.actual_yield_quantity),
        notes: y.notes || null,
      }));

      const lossesPayload = losses.map(l => ({
        material_id: l.material_id,
        loss_quantity: parseFloat(l.loss_quantity),
        loss_unit: l.loss_unit,
        loss_reason: l.loss_reason || null,
        notes: l.notes || null,
      }));

      const { error } = await (supabase.rpc as any)('finalize_production_order', {
        p_production_order_id: order.id,
        p_items: itemsPayload,
        p_losses: lossesPayload,
      });

      if (error) throw error;

      toast.success('Ordem finalizada com sucesso!');
      onFinalized();
      onClose();
    } catch (err: any) {
      console.error('Erro ao finalizar ordem:', err);
      toast.error(err.message || 'Erro ao finalizar ordem de produção');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Finalizar Ordem de Produção
          </DialogTitle>
          <DialogDescription>
            {order.order_name} — confirme os rendimentos reais e registre eventuais perdas
          </DialogDescription>
        </DialogHeader>

        {/* ---- Rendimentos Reais ---- */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-blue-600" />
            Rendimentos Reais
          </h3>
          <p className="text-xs text-muted-foreground">
            Confirme (ou corrija) a quantidade real produzida de cada produto.
          </p>

          <div className="rounded-lg border divide-y">
            {order.items.map((item, idx) => {
              const entry = yields[idx];
              const planned = item.total_yield_quantity;
              const actual = parseFloat(entry?.actual_yield_quantity ?? '');
              const diff = isNaN(actual) ? null : actual - planned;
              const pct = diff !== null && planned > 0
                ? ((diff / planned) * 100).toFixed(1)
                : null;

              return (
                <div key={item.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.bom.finished_material.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Planejado: <span className="font-mono">{planned} {item.yield_unit}</span>
                      </p>
                    </div>
                    {pct !== null && (
                      <Badge
                        variant={diff! < 0 ? 'destructive' : diff! > 0 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {diff! > 0 ? '+' : ''}{pct}%
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Rendimento real ({item.yield_unit})</Label>
                      <NumericInput
                        min="0"
                        step="0.01"
                        value={entry?.actual_yield_quantity ?? ''}
                        onChange={e => updateYield(idx, 'actual_yield_quantity', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Observação (opcional)</Label>
                      <Input
                        placeholder="ex: lote com boa consistência"
                        value={entry?.notes ?? ''}
                        onChange={e => updateYield(idx, 'notes', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- Perdas e Desperdícios ---- */}
        <section className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Perdas e Desperdícios
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </h3>
            <Button variant="outline" size="sm" onClick={addLoss}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar perda
            </Button>
          </div>

          {losses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma perda registrada. Clique em "Adicionar perda" para registrar.
            </p>
          ) : (
            <div className="space-y-2">
              {losses.map((loss, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2 bg-amber-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-800">Perda #{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => removeLoss(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Item perdido: produto produzido OU ingrediente */}
                    <div className="col-span-2">
                      <Label className="text-xs">Item perdido (produto pronto ou ingrediente)</Label>
                      <Select
                        value={loss.material_id}
                        onValueChange={val => updateLoss(idx, 'material_id', val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {lossProdutos.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Produtos produzidos (receita pronta)</SelectLabel>
                              {lossProdutos.map(o => (
                                <SelectItem key={`p-${o.id}`} value={o.id}>{o.name}</SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {lossIngredientes.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Ingredientes</SelectLabel>
                              {lossIngredientes.map(o => (
                                <SelectItem key={`i-${o.id}`} value={o.id}>{o.name}</SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantidade + Unidade */}
                    <div>
                      <Label className="text-xs">Quantidade perdida</Label>
                      <div className="flex gap-1">
                        <NumericInput
                          min="0.01"
                          step="0.01"
                          placeholder="0"
                          value={loss.loss_quantity}
                          onChange={e => updateLoss(idx, 'loss_quantity', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="flex items-center text-xs text-muted-foreground px-1">
                          {loss.loss_unit}
                        </span>
                      </div>
                    </div>

                    {/* Motivo */}
                    <div>
                      <Label className="text-xs">Motivo</Label>
                      <Select
                        value={loss.loss_reason}
                        onValueChange={val => updateLoss(idx, 'loss_reason', val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOSS_REASONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Observação */}
                    <div className="col-span-2">
                      <Label className="text-xs">Observação (opcional)</Label>
                      <Input
                        placeholder="ex: embalagem danificada ao chegar"
                        value={loss.notes}
                        onChange={e => updateLoss(idx, 'notes', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- Actions ---- */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Confirmar Finalização
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

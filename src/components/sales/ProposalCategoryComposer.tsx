import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Plus, Minus, Save, ArrowLeft, X, Factory,
  Scale, DollarSign, Users, TrendingUp, Loader2, CheckCircle2
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string;
  unit_weight: number;
  cost_price: number;
  average_price: number; // custo médio do estoque (mais preciso)
  usage_unit: string;
}

interface LineItem {
  material_id: string;
  qty_per_person: number;  // g ou unidades por pessoa
  use_per_person: boolean; // true = por pessoa, false = qtd fixa total
  fixed_qty: number;
}

interface CategoryState {
  [materialId: string]: LineItem;
}

interface Props {
  proposalId: string;
  onComplete: () => void;
  onCancel: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MARGIN_TARGET = 0.40; // margem sugerida 40%

const PRODUCT_CATEGORIES = [
  { key: 'Salgados',        label: 'Salgados',        color: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'Doces & Confeitaria', label: 'Doces',       color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { key: 'Bebidas',         label: 'Bebidas',          color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'Low Fat',         label: 'Low Fat / Fitness',color: 'bg-green-100 text-green-800 border-green-200' },
  { key: 'Frutas',          label: 'Frutas',           color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { key: 'Sobremesas',      label: 'Sobremesas',       color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProposalCategoryComposer({ proposalId, onComplete, onCancel }: Props) {
  const [materials, setMaterials]     = useState<Material[]>([]);
  const [items, setItems]             = useState<Record<string, CategoryState>>({});
  const [proposal, setProposal]       = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [approving, setApproving]     = useState(false);

  // ── Carregamento ─────────────────────────────────────────────────────────────

  useEffect(() => { loadData(); }, [proposalId]);

  const loadData = async () => {
    try {
      const [matRes, propRes] = await Promise.all([
        supabase
          .from('materials')
          .select('id, code, name, category, subcategory, unit_weight, cost_price, usage_unit')
          .eq('is_sellable', true)
          .eq('is_archived', false)
          .order('name'),
        supabase
          .from('proposals')
          .select('*, clients(name)')
          .eq('id', proposalId)
          .single(),
      ]);

      if (matRes.error)  throw matRes.error;
      if (propRes.error) throw propRes.error;

      // Buscar custo médio do estoque para cada material
      const matIds = matRes.data.map((m: any) => m.id);
      const { data: stockData } = await supabase
        .from('stock_items')
        .select('material_id, average_price')
        .in('material_id', matIds);

      const stockMap: Record<string, number> = {};
      stockData?.forEach((s: any) => { stockMap[s.material_id] = parseFloat(s.average_price || 0); });

      const enriched: Material[] = matRes.data.map((m: any) => ({
        ...m,
        unit_weight:   parseFloat(m.unit_weight   || 0),
        cost_price:    parseFloat(m.cost_price     || 0),
        average_price: stockMap[m.id] ?? parseFloat(m.cost_price || 0),
      }));

      setMaterials(enriched);
      setProposal(propRes.data);
      await loadExisting();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async () => {
    const { data: cats } = await supabase
      .from('proposal_categories')
      .select('id, category_label, proposal_category_items(material_id, qty_per_person, fixed_qty, item_kind)')
      .eq('proposal_id', proposalId);

    if (!cats?.length) return;

    const map: Record<string, CategoryState> = {};
    cats.forEach((cat: any) => {
      map[cat.category_label] = {};
      cat.proposal_category_items?.forEach((it: any) => {
        map[cat.category_label][it.material_id] = {
          material_id:    it.material_id,
          qty_per_person: parseFloat(it.qty_per_person || 0),
          use_per_person: !!it.qty_per_person,
          fixed_qty:      parseFloat(it.fixed_qty || 0),
        };
      });
    });
    setItems(map);
  };

  // ── Handlers de linha ────────────────────────────────────────────────────────

  const addMaterial = (catKey: string, matId: string) => {
    setItems(prev => ({
      ...prev,
      [catKey]: {
        ...(prev[catKey] || {}),
        [matId]: { material_id: matId, qty_per_person: 1, use_per_person: true, fixed_qty: 0 },
      },
    }));
  };

  const removeMaterial = (catKey: string, matId: string) => {
    setItems(prev => {
      const cat = { ...(prev[catKey] || {}) };
      delete cat[matId];
      return { ...prev, [catKey]: cat };
    });
  };

  const updateLine = (catKey: string, matId: string, patch: Partial<LineItem>) => {
    setItems(prev => ({
      ...prev,
      [catKey]: {
        ...(prev[catKey] || {}),
        [matId]: { ...(prev[catKey]?.[matId] || { material_id: matId, qty_per_person: 0, use_per_person: true, fixed_qty: 0 }), ...patch },
      },
    }));
  };

  // ── Cálculos em tempo real ───────────────────────────────────────────────────

  const numPeople = proposal?.number_of_people || 1;

  const totals = useMemo(() => {
    let totalWeightG   = 0;
    let totalCost      = 0;
    let totalItemCount = 0;

    Object.values(items).forEach(cat => {
      Object.values(cat).forEach(line => {
        const mat = materials.find(m => m.id === line.material_id);
        if (!mat) return;

        const effectiveQty = line.use_per_person
          ? line.qty_per_person * numPeople
          : line.fixed_qty;

        totalWeightG   += effectiveQty * mat.unit_weight;
        totalCost      += effectiveQty * mat.average_price;
        totalItemCount += effectiveQty;
      });
    });

    const weightPerPerson = totalWeightG   / numPeople;
    const costPerPerson   = totalCost      / numPeople;
    const suggestedPrice  = totalCost      / (1 - MARGIN_TARGET);
    const pricePerPerson  = suggestedPrice / numPeople;

    return { totalWeightG, totalCost, totalItemCount, weightPerPerson, costPerPerson, suggestedPrice, pricePerPerson };
  }, [items, materials, numPeople]);

  // ── Persistência ─────────────────────────────────────────────────────────────

  const persistItems = async () => {
    // Apagar categorias existentes
    await supabase.from('proposal_categories').delete().eq('proposal_id', proposalId);

    for (const [catLabel, catItems] of Object.entries(items)) {
      if (!Object.keys(catItems).length) continue;

      const catOrder = PRODUCT_CATEGORIES.findIndex(c => c.key === catLabel) + 1;
      const { data: cat, error: catErr } = await supabase
        .from('proposal_categories')
        .insert({ proposal_id: proposalId, category_label: catLabel, sort_order: catOrder })
        .select().single();
      if (catErr) throw catErr;

      const rows = Object.values(catItems).map(line => {
        const effectiveQty = line.use_per_person ? line.qty_per_person * numPeople : line.fixed_qty;
        return {
          category_id:    cat.id,
          material_id:    line.material_id,
          qty_per_person: line.use_per_person  ? line.qty_per_person : null,
          fixed_qty:      !line.use_per_person ? line.fixed_qty      : null,
          item_kind:      'produce_finished',
          unit_override:  null,
        };
      });

      const { error: itmErr } = await supabase.from('proposal_category_items').insert(rows);
      if (itmErr) throw itmErr;
    }

    // Atualizar totais da proposta
    await supabase
      .from('proposals')
      .update({
        total_weight: totals.totalWeightG,
        total_amount: totals.suggestedPrice,
        target_weight_per_person: totals.weightPerPerson,
      })
      .eq('id', proposalId);
  };

  const handleSave = async () => {
    if (totals.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
    try {
      setSaving(true);
      await persistItems();
      toast.success('Proposta salva!');
      onComplete();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (totals.totalItemCount === 0) { toast.error('Adicione pelo menos um item antes de aprovar'); return; }
    try {
      setApproving(true);

      // 1. Salvar itens
      await persistItems();

      // 2. Marcar como aprovada
      await supabase.from('proposals').update({ status: 'aprovada' }).eq('id', proposalId);

      // 3. Criar evento automaticamente
      const { error: evtErr } = await (supabase.rpc as any)('create_event_from_proposal', { p_proposal_id: proposalId });
      if (evtErr) console.warn('create_event_from_proposal:', evtErr.message);

      // 4. Gerar produção automaticamente
      const { error: prodErr } = await supabase.rpc('generate_production_from_proposal', { p_proposal_id: proposalId });
      if (prodErr) console.warn('generate_production_from_proposal:', prodErr.message);

      toast.success('Proposta aprovada! Evento e ordem de produção criados automaticamente.');
      onComplete();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao aprovar: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedMats = PRODUCT_CATEGORIES.map(cat => ({
    ...cat,
    mats: materials.filter(m => m.subcategory === cat.key || m.category === cat.key),
  }));

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Composição da Proposta</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {proposal?.proposal_number} · {proposal?.event_category} · {numPeople} pessoas
            {proposal?.clients?.name ? ` · ${proposal.clients.name}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Painel esquerdo: seleção de itens (2 colunas) ── */}
        <div className="xl:col-span-2 space-y-4">
          {groupedMats.map(cat => {
            const selected = Object.keys(items[cat.key] || {});
            const available = cat.mats.filter(m => !selected.includes(m.id));

            return (
              <Card key={cat.key}>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge className={cat.color}>{cat.label}</Badge>
                    <span className="text-xs text-muted-foreground font-normal">
                      {cat.mats.length} disponíveis · {selected.length} selecionados
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Adicionar material */}
                  {available.length > 0 && (
                    <Combobox
                      placeholder={`Adicionar ${cat.label.toLowerCase()}...`}
                      searchPlaceholder="Buscar..."
                      emptyText="Não encontrado"
                      options={available.map(m => ({
                        value: m.id,
                        label: `${m.name} — ${m.unit_weight}g — ${fmt(m.average_price)}/${m.usage_unit}`
                      }))}
                      onSelect={id => id && addMaterial(cat.key, id)}
                    />
                  )}

                  {/* Itens selecionados */}
                  {selected.map(matId => {
                    const mat  = materials.find(m => m.id === matId);
                    const line = items[cat.key][matId];
                    if (!mat || !line) return null;

                    const qty        = line.use_per_person ? line.qty_per_person : line.fixed_qty;
                    const totalQty   = line.use_per_person ? qty * numPeople : qty;
                    const totalW     = totalQty * mat.unit_weight;
                    const totalC     = totalQty * mat.average_price;

                    return (
                      <div key={matId} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-muted/20">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{mat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mat.unit_weight}g/un · {fmt(mat.average_price)}/{mat.usage_unit}
                          </p>
                        </div>

                        {/* Toggle por pessoa / total */}
                        <div className="flex items-center gap-1 text-xs">
                          <button
                            onClick={() => updateLine(cat.key, matId, { use_per_person: true })}
                            className={`px-2 py-1 rounded ${line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          >
                            /pessoa
                          </button>
                          <button
                            onClick={() => updateLine(cat.key, matId, { use_per_person: false })}
                            className={`px-2 py-1 rounded ${!line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          >
                            total
                          </button>
                        </div>

                        {/* Quantidade */}
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateLine(cat.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: Math.max(0, qty - 1) })}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number" min="0" value={qty}
                            onChange={e => updateLine(cat.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: parseFloat(e.target.value) || 0 })}
                            className="w-16 h-7 text-center text-sm"
                          />
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateLine(cat.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: qty + 1 })}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Totais da linha */}
                        <div className="text-xs text-right text-muted-foreground min-w-[100px]">
                          <span className="block font-medium text-foreground">{totalW.toFixed(0)}g total</span>
                          <span>{fmt(totalC)}</span>
                        </div>

                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMaterial(cat.key, matId)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}

                  {selected.length === 0 && cat.mats.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum material cadastrado nesta categoria
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Painel direito: resumo em tempo real ── */}
        <div className="xl:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base">Resumo da Proposta</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">

                {/* Por pessoa */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por pessoa</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Scale className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{totals.weightPerPerson.toFixed(0)}g</p>
                      <p className="text-xs text-muted-foreground">Peso</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{fmt(totals.costPerPerson)}</p>
                      <p className="text-xs text-muted-foreground">Custo</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Total ({numPeople} pessoas)
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peso total</span>
                      <span className="font-medium">{(totals.totalWeightG / 1000).toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo total</span>
                      <span className="font-medium">{fmt(totals.totalCost)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Precificação */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Precificação (margem {(MARGIN_TARGET * 100).toFixed(0)}%)
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor sugerido</span>
                      <span className="font-bold text-primary text-base">{fmt(totals.suggestedPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Por pessoa</span>
                      <span className="font-semibold">{fmt(totals.pricePerPerson)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Ações */}
                <div className="space-y-2 pt-1">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleSave}
                    disabled={saving || totals.totalItemCount === 0}
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar rascunho
                  </Button>

                  <Button
                    className="w-full"
                    onClick={handleApprove}
                    disabled={approving || totals.totalItemCount === 0}
                  >
                    {approving
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <CheckCircle2 className="h-4 w-4 mr-2" />
                    }
                    {approving ? 'Aprovando...' : 'Aprovar proposta'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Ao aprovar, evento e ordem de produção são criados automaticamente
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}

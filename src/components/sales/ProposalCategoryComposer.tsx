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
  Plus, Minus, Save, ArrowLeft, X, Trash2,
  Scale, DollarSign, Loader2, CheckCircle2, CalendarClock, MapPin
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

// section state: { [sectionKey]: { [materialId]: LineItem } }
interface SectionState {
  [sectionKey: string]: { [materialId: string]: LineItem };
}

interface Composition {
  localId: string;            // id local estável (índice/contador) p/ compositions não salvas
  dbId: string | null;        // id existente no banco (se carregado)
  name: string;
  scheduled_date: string;     // 'YYYY-MM-DD' ou ''
  scheduled_time: string;     // 'HH:MM' ou ''
  location: string;
  number_of_people: number | null; // null = usa nº pessoas da proposta
  notes: string;
}

interface Props {
  proposalId: string;
  onComplete: () => void;
  onCancel: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MARGIN_TARGET = 0.40; // margem sugerida 40%

// Cada seção da proposta tem um label, cor (tailwind) e uma regra de match.
// Um material pode aparecer em mais de uma seção (ex.: fruta tagueada Low Fat
// aparece em Frutas E em Low Fat) — comportamento intencional.
// A `key` é usada como proposal_categories.category_label na persistência.
interface SectionDef {
  key: string;
  label: string;
  color: string;
  match: { category?: string; subcategory?: string; tagCode?: string };
}

const SECTIONS: SectionDef[] = [
  { key: 'salgados',   label: 'Salgados',          color: 'bg-red-100 text-red-800 border-red-200',          match: { category: 'Salgados' } },
  { key: 'doces',      label: 'Doces',             color: 'bg-pink-100 text-pink-800 border-pink-200',       match: { category: 'Doces & Confeitaria' } },
  { key: 'bebidas',    label: 'Bebidas',           color: 'bg-blue-100 text-blue-800 border-blue-200',       match: { category: 'Bebidas' } },
  { key: 'frutas',     label: 'Frutas',            color: 'bg-orange-100 text-orange-800 border-orange-200', match: { subcategory: 'Hortifruti' } },
  { key: 'sobremesas', label: 'Sobremesas',        color: 'bg-purple-100 text-purple-800 border-purple-200', match: { subcategory: 'Sobremesas' } },
  { key: 'lowfat',     label: 'Low Fat / Fitness', color: 'bg-green-100 text-green-800 border-green-200',    match: { tagCode: 'REST_LOWFAT' } },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const emptyLine = (matId: string): LineItem => ({
  material_id: matId, qty_per_person: 1, use_per_person: true, fixed_qty: 0,
});

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProposalCategoryComposer({ proposalId, onComplete, onCancel }: Props) {
  const [materials, setMaterials]   = useState<Material[]>([]);
  // map materialId -> Set<tagCode>
  const [tagMap, setTagMap]         = useState<Record<string, Set<string>>>({});
  const [compositions, setCompositions] = useState<Composition[]>([]);
  // items: { [compositionLocalId]: { [sectionKey]: { [materialId]: LineItem } } }
  const [items, setItems]           = useState<Record<string, SectionState>>({});
  const [proposal, setProposal]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [approving, setApproving]   = useState(false);

  // contador para localIds estáveis (sem Date.now/Math.random)
  const [localIdSeq, setLocalIdSeq] = useState(1);
  const nextLocalId = () => {
    const id = `c${localIdSeq}`;
    setLocalIdSeq(s => s + 1);
    return id;
  };

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

      // Buscar custo da ficha técnica (recipes_bom), custo médio de estoque e tags
      const matIds = matRes.data.map((m: any) => m.id);
      const [stockRes, bomRes, tagRes] = await Promise.all([
        supabase
          .from('stock_items')
          .select('material_id, average_price')
          .in('material_id', matIds),
        supabase
          .from('recipes_bom')
          .select('finished_material_id, cached_unit_cost')
          .in('finished_material_id', matIds),
        supabase
          .from('material_tags')
          .select('material_id, taxonomy_terms(code)')
          .in('material_id', matIds),
      ]);

      const stockMap: Record<string, number> = {};
      stockRes.data?.forEach((s: any) => { stockMap[s.material_id] = parseFloat(s.average_price || 0); });

      // cached_unit_cost = CMV real calculado pela ficha técnica (mais preciso para produtos produzidos)
      const bomMap: Record<string, number> = {};
      bomRes.data?.forEach((b: any) => { bomMap[b.finished_material_id] = parseFloat(b.cached_unit_cost || 0); });

      // map materialId -> Set<tagCode>
      const tags: Record<string, Set<string>> = {};
      tagRes.data?.forEach((t: any) => {
        const code = t.taxonomy_terms?.code;
        if (!code) return;
        if (!tags[t.material_id]) tags[t.material_id] = new Set();
        tags[t.material_id].add(code);
      });

      const enriched: Material[] = matRes.data.map((m: any) => ({
        ...m,
        unit_weight:   parseFloat(m.unit_weight   || 0),
        cost_price:    parseFloat(m.cost_price     || 0),
        // Prioridade: cached_unit_cost (ficha técnica) > average_price (estoque) > cost_price (manual)
        average_price: bomMap[m.id] || stockMap[m.id] || parseFloat(m.cost_price || 0),
      }));

      setMaterials(enriched);
      setTagMap(tags);
      setProposal(propRes.data);
      await loadExisting(propRes.data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async (prop: any) => {
    const [compRes, catRes] = await Promise.all([
      supabase
        .from('proposal_compositions')
        .select('id, name, scheduled_date, scheduled_time, location, number_of_people, notes, sort_order')
        .eq('proposal_id', proposalId)
        .order('sort_order'),
      supabase
        .from('proposal_categories')
        .select('id, category_label, composition_id, proposal_category_items(material_id, qty_per_person, fixed_qty, item_kind)')
        .eq('proposal_id', proposalId),
    ]);

    const dbComps = compRes.data || [];
    const dbCats  = catRes.data  || [];

    // Construir lista de compositions locais.
    let seq = 1;
    const comps: Composition[] = [];
    const dbIdToLocal: Record<string, string> = {};

    dbComps.forEach((c: any) => {
      const localId = `c${seq++}`;
      dbIdToLocal[c.id] = localId;
      comps.push({
        localId,
        dbId: c.id,
        name: c.name || '',
        scheduled_date: c.scheduled_date || '',
        scheduled_time: c.scheduled_time ? String(c.scheduled_time).slice(0, 5) : '',
        location: c.location || '',
        number_of_people: c.number_of_people ?? null,
        notes: c.notes || '',
      });
    });

    // Se não há compositions salvas mas há categorias legadas, ou nenhum dado,
    // garantir ao menos UMA composition default.
    if (!comps.length) {
      comps.push({
        localId: `c${seq++}`,
        dbId: null,
        name: 'Composição 1',
        scheduled_date: prop?.event_date || '',
        scheduled_time: '',
        location: '',
        number_of_people: null,
        notes: '',
      });
    }
    const firstLocalId = comps[0].localId;

    // Rebuild items state. Categorias com composition_id NULL (legado) vão p/ a primeira composition.
    const newItems: Record<string, SectionState> = {};
    comps.forEach(c => { newItems[c.localId] = {}; });

    dbCats.forEach((cat: any) => {
      const localId = cat.composition_id ? (dbIdToLocal[cat.composition_id] || firstLocalId) : firstLocalId;
      if (!newItems[localId]) newItems[localId] = {};
      const sectionKey = cat.category_label;
      if (!newItems[localId][sectionKey]) newItems[localId][sectionKey] = {};
      cat.proposal_category_items?.forEach((it: any) => {
        newItems[localId][sectionKey][it.material_id] = {
          material_id:    it.material_id,
          qty_per_person: parseFloat(it.qty_per_person || 0),
          use_per_person: it.qty_per_person != null,
          fixed_qty:      parseFloat(it.fixed_qty || 0),
        };
      });
    });

    setLocalIdSeq(seq);
    setCompositions(comps);
    setItems(newItems);
  };

  // ── Seções: quais materiais cada seção oferece (match por categoria/subcategoria/tag) ──

  const sectionMaterials = useMemo(() => {
    const matches = (mat: Material, sec: SectionDef): boolean => {
      if (sec.match.category && mat.category === sec.match.category) return true;
      if (sec.match.subcategory && mat.subcategory === sec.match.subcategory) return true;
      if (sec.match.tagCode && tagMap[mat.id]?.has(sec.match.tagCode)) return true;
      return false;
    };
    const out: Record<string, Material[]> = {};
    SECTIONS.forEach(sec => {
      out[sec.key] = materials.filter(m => matches(m, sec));
    });
    return out;
  }, [materials, tagMap]);

  // ── Handlers de composition ──────────────────────────────────────────────────

  const addComposition = () => {
    const localId = nextLocalId();
    setCompositions(prev => [...prev, {
      localId,
      dbId: null,
      name: `Composição ${prev.length + 1}`,
      scheduled_date: '',
      scheduled_time: '',
      location: '',
      number_of_people: null,
      notes: '',
    }]);
    setItems(prev => ({ ...prev, [localId]: {} }));
  };

  const removeComposition = (localId: string) => {
    if (compositions.length <= 1) {
      toast.error('A proposta precisa de ao menos uma composição');
      return;
    }
    setCompositions(prev => prev.filter(c => c.localId !== localId));
    setItems(prev => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  };

  const updateComposition = (localId: string, patch: Partial<Composition>) => {
    setCompositions(prev => prev.map(c => c.localId === localId ? { ...c, ...patch } : c));
  };

  // ── Handlers de linha (escopo composition + seção) ─────────────────────────────

  const addMaterial = (compId: string, sectionKey: string, matId: string) => {
    setItems(prev => ({
      ...prev,
      [compId]: {
        ...(prev[compId] || {}),
        [sectionKey]: {
          ...((prev[compId] || {})[sectionKey] || {}),
          [matId]: emptyLine(matId),
        },
      },
    }));
  };

  const removeMaterial = (compId: string, sectionKey: string, matId: string) => {
    setItems(prev => {
      const sec = { ...((prev[compId] || {})[sectionKey] || {}) };
      delete sec[matId];
      return { ...prev, [compId]: { ...(prev[compId] || {}), [sectionKey]: sec } };
    });
  };

  const updateLine = (compId: string, sectionKey: string, matId: string, patch: Partial<LineItem>) => {
    setItems(prev => {
      const sec = (prev[compId] || {})[sectionKey] || {};
      const current = sec[matId] || emptyLine(matId);
      return {
        ...prev,
        [compId]: {
          ...(prev[compId] || {}),
          [sectionKey]: { ...sec, [matId]: { ...current, ...patch } },
        },
      };
    });
  };

  // ── Cálculos em tempo real ───────────────────────────────────────────────────

  const proposalPeople = proposal?.number_of_people || 1;

  // Totais por composition (localId) + grand total.
  const calc = useMemo(() => {
    const peopleFor = (c: Composition) =>
      (c.number_of_people && c.number_of_people > 0) ? c.number_of_people : proposalPeople;

    const perComp: Record<string, {
      totalWeightG: number; totalCost: number; totalItemCount: number;
      weightPerPerson: number; costPerPerson: number; suggestedPrice: number; pricePerPerson: number;
      people: number;
    }> = {};

    let grandWeightG = 0;
    let grandCost = 0;
    let grandItemCount = 0;
    let grandSuggested = 0;

    compositions.forEach(c => {
      const people = peopleFor(c);
      let weightG = 0, cost = 0, itemCount = 0;
      const sections = items[c.localId] || {};
      Object.values(sections).forEach(sec => {
        Object.values(sec).forEach(line => {
          const mat = materials.find(m => m.id === line.material_id);
          if (!mat) return;
          const effectiveQty = line.use_per_person ? line.qty_per_person * people : line.fixed_qty;
          weightG   += effectiveQty * mat.unit_weight;
          cost      += effectiveQty * mat.average_price;
          itemCount += effectiveQty;
        });
      });
      const suggestedPrice = cost / (1 - MARGIN_TARGET);
      perComp[c.localId] = {
        totalWeightG: weightG,
        totalCost: cost,
        totalItemCount: itemCount,
        weightPerPerson: weightG / people,
        costPerPerson: cost / people,
        suggestedPrice,
        pricePerPerson: suggestedPrice / people,
        people,
      };
      grandWeightG   += weightG;
      grandCost      += cost;
      grandItemCount += itemCount;
      grandSuggested += suggestedPrice;
    });

    return {
      perComp,
      grand: {
        totalWeightG: grandWeightG,
        totalCost: grandCost,
        totalItemCount: grandItemCount,
        suggestedPrice: grandSuggested,
        // peso/pessoa de referência usa nº de pessoas da proposta
        weightPerPerson: grandWeightG / proposalPeople,
        pricePerPerson: grandSuggested / proposalPeople,
      },
    };
  }, [items, materials, compositions, proposalPeople]);

  // ── Persistência ─────────────────────────────────────────────────────────────

  const persistItems = async () => {
    // Apagar categorias (cascata nos itens) e compositions existentes da proposta.
    await supabase.from('proposal_categories').delete().eq('proposal_id', proposalId);
    await supabase.from('proposal_compositions').delete().eq('proposal_id', proposalId);

    // Re-inserir cada composition + suas seções/itens.
    for (let ci = 0; ci < compositions.length; ci++) {
      const c = compositions[ci];
      const compStats = calc.perComp[c.localId];

      const { data: compRow, error: compErr } = await supabase
        .from('proposal_compositions')
        .insert({
          proposal_id: proposalId,
          name: c.name || `Composição ${ci + 1}`,
          scheduled_date: c.scheduled_date || null,
          scheduled_time: c.scheduled_time || null,
          location: c.location || null,
          number_of_people: c.number_of_people ?? null,
          price_per_person: compStats ? compStats.pricePerPerson : 0,
          sort_order: ci + 1,
          notes: c.notes || null,
        })
        .select().single();
      if (compErr) throw compErr;

      const sections = items[c.localId] || {};
      for (const sec of SECTIONS) {
        const sectionItems = sections[sec.key];
        if (!sectionItems || !Object.keys(sectionItems).length) continue;

        const sortOrder = SECTIONS.findIndex(s => s.key === sec.key) + 1;
        const { data: catRow, error: catErr } = await supabase
          .from('proposal_categories')
          .insert({
            proposal_id: proposalId,
            composition_id: compRow.id,
            category_label: sec.key,
            sort_order: sortOrder,
          })
          .select().single();
        if (catErr) throw catErr;

        const rows = Object.values(sectionItems).map(line => ({
          category_id:    catRow.id,
          material_id:    line.material_id,
          qty_per_person: line.use_per_person  ? line.qty_per_person : null,
          fixed_qty:      !line.use_per_person ? line.fixed_qty      : null,
          item_kind:      'produce_finished',
          unit_override:  null,
        }));

        const { error: itmErr } = await supabase.from('proposal_category_items').insert(rows);
        if (itmErr) throw itmErr;
      }
    }

    // Atualizar totais da proposta (grand totals).
    await supabase
      .from('proposals')
      .update({
        total_weight: calc.grand.totalWeightG,
        total_amount: calc.grand.suggestedPrice,
        target_weight_per_person: calc.grand.weightPerPerson,
      })
      .eq('id', proposalId);
  };

  const handleSave = async () => {
    if (calc.grand.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
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
    if (calc.grand.totalItemCount === 0) { toast.error('Adicione pelo menos um item antes de aprovar'); return; }
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

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Composição da Proposta</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {proposal?.proposal_number} · {proposal?.event_category} · {proposalPeople} pessoas
            {proposal?.clients?.name ? ` · ${proposal.clients.name}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Painel esquerdo: composições + seções (2 colunas) ── */}
        <div className="xl:col-span-2 space-y-6">

          {compositions.map((comp, compIdx) => {
            const compStats = calc.perComp[comp.localId];
            const people = compStats ? compStats.people : proposalPeople;

            return (
              <Card key={comp.localId} className="border-primary/20">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                        <Input
                          value={comp.name}
                          onChange={e => updateComposition(comp.localId, { name: e.target.value })}
                          placeholder={`Composição ${compIdx + 1}`}
                          className="h-8 font-semibold text-base max-w-xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Data</Label>
                          <Input
                            type="date"
                            value={comp.scheduled_date}
                            onChange={e => updateComposition(comp.localId, { scheduled_date: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Horário</Label>
                          <Input
                            type="time"
                            value={comp.scheduled_time}
                            onChange={e => updateComposition(comp.localId, { scheduled_time: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Local
                          </Label>
                          <Input
                            value={comp.location}
                            onChange={e => updateComposition(comp.localId, { location: e.target.value })}
                            placeholder="Local do momento"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeComposition(comp.localId)}
                      title="Remover momento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 space-y-4">
                  {/* Seções dentro da composition */}
                  {SECTIONS.map(sec => {
                    const secMats = sectionMaterials[sec.key] || [];
                    const sectionItems = (items[comp.localId] || {})[sec.key] || {};
                    const selected = Object.keys(sectionItems);
                    const available = secMats.filter(m => !selected.includes(m.id));

                    return (
                      <div key={sec.key} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className={sec.color}>{sec.label}</Badge>
                          <span className="text-xs text-muted-foreground font-normal">
                            {secMats.length} disponíveis · {selected.length} selecionados
                          </span>
                        </div>

                        {/* Adicionar material */}
                        {available.length > 0 && (
                          <Combobox
                            placeholder={`Adicionar ${sec.label.toLowerCase()}...`}
                            searchPlaceholder="Buscar..."
                            emptyText="Não encontrado"
                            options={available.map(m => ({
                              value: m.id,
                              label: `${m.name} — ${m.unit_weight}g — ${fmt(m.average_price)}/${m.usage_unit}`
                            }))}
                            onSelect={id => id && addMaterial(comp.localId, sec.key, id)}
                          />
                        )}

                        {/* Itens selecionados */}
                        {selected.map(matId => {
                          const mat  = materials.find(m => m.id === matId);
                          const line = sectionItems[matId];
                          if (!mat || !line) return null;

                          const qty      = line.use_per_person ? line.qty_per_person : line.fixed_qty;
                          const totalQty = line.use_per_person ? qty * people : qty;
                          const totalW   = totalQty * mat.unit_weight;
                          const totalC   = totalQty * mat.average_price;

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
                                  onClick={() => updateLine(comp.localId, sec.key, matId, { use_per_person: true })}
                                  className={`px-2 py-1 rounded ${line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                >
                                  /pessoa
                                </button>
                                <button
                                  onClick={() => updateLine(comp.localId, sec.key, matId, { use_per_person: false })}
                                  className={`px-2 py-1 rounded ${!line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                >
                                  total
                                </button>
                              </div>

                              {/* Quantidade */}
                              <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-7 w-7"
                                  onClick={() => updateLine(comp.localId, sec.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: Math.max(0, qty - 1) })}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number" min="0" value={qty}
                                  onChange={e => updateLine(comp.localId, sec.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: parseFloat(e.target.value) || 0 })}
                                  className="w-16 h-7 text-center text-sm"
                                />
                                <Button variant="outline" size="icon" className="h-7 w-7"
                                  onClick={() => updateLine(comp.localId, sec.key, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: qty + 1 })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Totais da linha */}
                              <div className="text-xs text-right text-muted-foreground min-w-[100px]">
                                <span className="block font-medium text-foreground">{totalW.toFixed(0)}g total</span>
                                <span>{fmt(totalC)}</span>
                              </div>

                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeMaterial(comp.localId, sec.key, matId)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}

                        {selected.length === 0 && secMats.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Nenhum material disponível nesta seção
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Totais da composition */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      Subtotal ({people} pessoas)
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        Custo/pessoa <span className="font-medium text-foreground">{fmt(compStats?.costPerPerson || 0)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Preço/pessoa <span className="font-semibold text-primary">{fmt(compStats?.pricePerPerson || 0)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Total <span className="font-bold text-primary">{fmt(compStats?.suggestedPrice || 0)}</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button variant="outline" className="w-full" onClick={addComposition}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar momento
          </Button>
        </div>

        {/* ── Painel direito: resumo em tempo real ── */}
        <div className="xl:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base">Resumo da Proposta</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">

                {/* Por pessoa (referência da proposta) */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por pessoa</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Scale className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{calc.grand.weightPerPerson.toFixed(0)}g</p>
                      <p className="text-xs text-muted-foreground">Peso</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{fmt(calc.grand.totalCost / proposalPeople)}</p>
                      <p className="text-xs text-muted-foreground">Custo</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Total geral */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Total ({compositions.length} {compositions.length === 1 ? 'composição' : 'composições'} · {proposalPeople} pessoas)
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peso total</span>
                      <span className="font-medium">{(calc.grand.totalWeightG / 1000).toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo total</span>
                      <span className="font-medium">{fmt(calc.grand.totalCost)}</span>
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
                      <span className="font-bold text-primary text-base">{fmt(calc.grand.suggestedPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Por pessoa</span>
                      <span className="font-semibold">{fmt(calc.grand.pricePerPerson)}</span>
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
                    disabled={saving || calc.grand.totalItemCount === 0}
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar rascunho
                  </Button>

                  <Button
                    className="w-full"
                    onClick={handleApprove}
                    disabled={approving || calc.grand.totalItemCount === 0}
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

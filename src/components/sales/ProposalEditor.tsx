import React, { useState, useEffect, useMemo } from 'react';
import { todayLocalISO } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { computeDistanceKmFromCep } from '@/lib/geo';
import { toast } from 'sonner';
import {
  Plus, Minus, Save, ArrowLeft, X, Scale, DollarSign,
  CheckCircle2, Loader2, Users, Calendar, ChefHat, Trash2,
  CalendarClock, MapPin, Send,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; name: string; fantasy_name?: string | null; distance_km?: number | null; }
interface Department { id: string; name: string; }
interface Unit { id: string; name: string; distance_km?: number | null; }
interface Room { id: string; name: string; unit_id: string; }
interface Contact { id: string; name: string; department_id?: string | null; }

interface SellableMaterial {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  unit_weight: number;
  cost_price: number;
  average_price: number;
  sale_price: number;   // preço de venda por unidade (praticado ?? sugerido ?? fallback)
  usage_unit: string;
}

interface LineItem {
  material_id: string;
  qty_per_person: number;
  use_per_person: boolean;
  fixed_qty: number;
}

// section state: { [sectionKey]: { [materialId]: LineItem } }
interface SectionState {
  [sectionKey: string]: { [materialId: string]: LineItem };
}

interface Composition {
  localId: string;            // id local estável (contador) p/ compositions não salvas
  dbId: string | null;        // id existente no banco (se carregado)
  name: string;
  scheduled_date: string;     // 'YYYY-MM-DD' ou ''
  scheduled_time: string;     // 'HH:MM' ou ''
  location: string;
  number_of_people: number | null; // null = usa nº pessoas da proposta
  notes: string;
}

interface ProposalEditorProps {
  proposalId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN_TARGET = 0.40;

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
  { key: 'salgados',   label: 'Salgados', color: 'bg-red-100 text-red-800 border-red-200',          match: { category: 'Salgados' } },
  { key: 'doces',      label: 'Doces',    color: 'bg-pink-100 text-pink-800 border-pink-200',       match: { category: 'Doces & Confeitaria' } },
  { key: 'light',      label: 'Light',    color: 'bg-green-100 text-green-800 border-green-200',     match: { tagCode: 'REST_LOWFAT' } },
  { key: 'bebidas',    label: 'Bebidas',  color: 'bg-blue-100 text-blue-800 border-blue-200',       match: { category: 'Bebidas' } },
];

const EVENT_CATEGORIES = [
  'Coffee Break', 'Brunch', 'Coquetel', 'Almoco',
  'Jantar', 'Festa Infantil', 'Casamento', 'Reuniao Corporativa',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const emptyLine = (matId: string): LineItem => ({
  material_id: matId, qty_per_person: 1, use_per_person: true, fixed_qty: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposalId, onComplete, onCancel }: ProposalEditorProps) {
  const isNew = !proposalId;

  // ── Header form state ──────────────────────────────────────────────────────
  const [clientId, setClientId]             = useState('');
  const [eventCategory, setEventCategory]   = useState('');
  const [eventDate, setEventDate]           = useState('');
  const [proposalDate, setProposalDate]     = useState(todayLocalISO());
  const [numberOfPeople, setNumberOfPeople] = useState<number>(0);
  const [notes, setNotes]                   = useState('');
  const [departmentId, setDepartmentId]     = useState('');
  const [unitId, setUnitId]                 = useState('');
  const [roomId, setRoomId]                 = useState('');
  const [contactId, setContactId]           = useState('');
  // Local avulso (evento em endereço que não é unidade do cliente — ex.: salão alugado)
  const [useAdhocLocation, setUseAdhocLocation] = useState(false);
  const [adhocName, setAdhocName]               = useState('');
  const [adhocZip, setAdhocZip]                 = useState('');
  const [adhocDistance, setAdhocDistance]       = useState<number | null>(null);
  const [adhocCalculating, setAdhocCalculating] = useState(false);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [clients, setClients]         = useState<Client[]>([]);
  const [deliveryTrips, setDeliveryTrips] = useState(4);     // nº trajetos (logística)
  const [costPerKm, setCostPerKm]         = useState(1.5);   // R$/km (logística)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits]             = useState<Unit[]>([]);
  const [rooms, setRooms]             = useState<Room[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // ── Composition state ──────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<SellableMaterial[]>([]);
  // map materialId -> Set<tagCode>
  const [tagMap, setTagMap]       = useState<Record<string, Set<string>>>({});
  const [compositions, setCompositions] = useState<Composition[]>([]);
  // items: { [compositionLocalId]: { [sectionKey]: { [materialId]: LineItem } } }
  const [items, setItems]         = useState<Record<string, SectionState>>({});

  // contador para localIds estáveis (sem Date.now/Math.random)
  const [localIdSeq, setLocalIdSeq] = useState(1);
  const nextLocalId = () => {
    const id = `c${localIdSeq}`;
    setLocalIdSeq(s => s + 1);
    return id;
  };

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [approving, setApproving] = useState(false);
  const [sending, setSending]   = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => { bootstrap(); }, [proposalId]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      await Promise.all([loadClients(), loadMaterials(), loadLogisticsParams()]);

      if (proposalId) {
        await loadExistingProposal(proposalId);
      } else {
        // Proposta nova: garantir ao menos uma composition default.
        setCompositions([{
          localId: 'c0',
          dbId: null,
          name: 'Composição 1',
          scheduled_date: '',
          scheduled_time: '',
          location: '',
          number_of_people: null,
          notes: '',
        }]);
        setItems({ c0: {} });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, fantasy_name, distance_km')
      .eq('status', 'Ativo')
      .order('name');
    setClients(data || []);
  };

  // Parâmetros de logística (frete por evento) — globais em app_settings
  const loadLogisticsParams = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['logistics.delivery_trips', 'logistics.cost_per_km']);
    const map = new Map((data || []).map((r: any) => [r.key, r.value]));
    setDeliveryTrips(parseFloat(map.get('logistics.delivery_trips') ?? '4') || 0);
    setCostPerKm(parseFloat(map.get('logistics.cost_per_km') ?? '1.50') || 0);
  };

  const loadMaterials = async () => {
    const { data: mats } = await supabase
      .from('materials')
      .select('id, code, name, category, subcategory, unit_weight, cost_price, usage_unit, practiced_price, suggested_price')
      .eq('is_sellable', true)
      .eq('is_archived', false)
      .order('name');

    if (!mats?.length) return;

    const matIds = mats.map((m: any) => m.id);
    const [stockRes, bomRes, tagRes] = await Promise.all([
      supabase.from('stock_items').select('material_id, average_price').in('material_id', matIds),
      supabase.from('recipes_bom').select('finished_material_id, cached_unit_cost').in('finished_material_id', matIds),
      supabase.from('material_tags').select('material_id, taxonomy_terms(code)').in('material_id', matIds),
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

    setTagMap(tags);
    setMaterials(mats.map((m: any) => {
      // Custo: cached_unit_cost (ficha) > average_price (estoque) > cost_price (manual)
      const avg = bomMap[m.id] || stockMap[m.id] || parseFloat(m.cost_price || 0);
      // Preço de venda do produto: praticado > sugerido (motor de precificação) >
      // fallback (custo + margem padrão) p/ produtos ainda sem preço calculado.
      const practiced = m.practiced_price != null ? parseFloat(m.practiced_price) : null;
      const suggested = m.suggested_price != null ? parseFloat(m.suggested_price) : null;
      const sale = practiced ?? suggested ?? (avg > 0 ? avg / (1 - MARGIN_TARGET) : 0);
      return {
        ...m,
        unit_weight:   parseFloat(m.unit_weight || 0),
        cost_price:    parseFloat(m.cost_price  || 0),
        average_price: avg,
        sale_price:    sale,
      };
    }));
  };

  const loadExistingProposal = async (id: string) => {
    const { data: prop } = await supabase
      .from('proposals')
      .select('*, clients(name, fantasy_name)')
      .eq('id', id)
      .single();

    if (!prop) return;

    setClientId(prop.client_id || '');
    setEventCategory(prop.event_category || '');
    setEventDate(prop.event_date || '');
    setProposalDate(prop.proposal_date || todayLocalISO());
    setNumberOfPeople(prop.number_of_people || 0);
    setNotes(prop.notes || '');
    setDepartmentId(prop.department_id || '');
    setUnitId(prop.unit_id || '');
    setRoomId(prop.room_id || '');
    setContactId(prop.contact_id || '');
    // Local avulso (se a proposta tiver CEP de local avulso gravado)
    const hasAdhoc = !!prop.event_location_zip || prop.event_location_distance_km != null;
    setUseAdhocLocation(hasAdhoc);
    setAdhocName(prop.event_location_name || '');
    setAdhocZip(prop.event_location_zip || '');
    setAdhocDistance(prop.event_location_distance_km ?? null);

    if (prop.client_id) loadClientStructure(prop.client_id);

    // Load existing compositions + categories + items
    const [compRes, catRes] = await Promise.all([
      supabase
        .from('proposal_compositions')
        .select('id, name, scheduled_date, scheduled_time, location, number_of_people, notes, sort_order')
        .eq('proposal_id', id)
        .order('sort_order'),
      supabase
        .from('proposal_categories')
        .select('id, category_label, composition_id, proposal_category_items(material_id, qty_per_person, fixed_qty, item_kind)')
        .eq('proposal_id', id),
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

  const loadClientStructure = async (id: string) => {
    setLoadingStructure(true);
    try {
      const [deptR, unitR, roomR, contactR] = await Promise.all([
        supabase.from('client_departments').select('id, name').eq('client_id', id).eq('is_active', true).order('name'),
        supabase.from('client_units').select('id, name, distance_km').eq('client_id', id).eq('is_active', true).order('name'),
        supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', id).eq('is_active', true).order('name'),
        supabase.from('client_contacts').select('id, name, department_id').eq('client_id', id).eq('is_active', true).order('name'),
      ]);
      setDepartments(deptR.data || []);
      setUnits(unitR.data || []);
      setRooms(roomR.data || []);
      setContacts(contactR.data || []);
    } finally {
      setLoadingStructure(false);
    }
  };

  const handleClientChange = (id: string) => {
    setClientId(id);
    setDepartmentId(''); setUnitId(''); setRoomId(''); setContactId('');
    setDepartments([]); setUnits([]); setRooms([]); setContacts([]);
    if (id) loadClientStructure(id);
  };

  // ── Seções: quais materiais cada seção oferece (match por categoria/subcategoria/tag) ──

  const sectionMaterials = useMemo(() => {
    const matches = (mat: SellableMaterial, sec: SectionDef): boolean => {
      if (sec.match.category && mat.category === sec.match.category) return true;
      if (sec.match.subcategory && mat.subcategory === sec.match.subcategory) return true;
      if (sec.match.tagCode && tagMap[mat.id]?.has(sec.match.tagCode)) return true;
      return false;
    };
    const out: Record<string, SellableMaterial[]> = {};
    SECTIONS.forEach(sec => {
      out[sec.key] = materials.filter(m => matches(m, sec));
    });
    return out;
  }, [materials, tagMap]);

  const filteredRooms   = useMemo(() => unitId ? rooms.filter(r => r.unit_id === unitId) : rooms, [rooms, unitId]);
  const filteredContacts = useMemo(() => departmentId ? contacts.filter(c => !c.department_id || c.department_id === departmentId) : contacts, [contacts, departmentId]);

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

  // ── Totals (por composition + grand total) ───────────────────────────────────

  const numPeople = numberOfPeople || 1;

  const calc = useMemo(() => {
    const peopleFor = (c: Composition) =>
      (c.number_of_people && c.number_of_people > 0) ? c.number_of_people : numPeople;

    // Frete por composição (delivery) = distância × nº trajetos × R$/km.
    // Distância vem da UNIDADE selecionada (cada local tem distância própria — ex.:
    // CMPC Guaíba ≠ Porto Alegre ≠ Barra do Ribeiro); fallback na distância do cliente.
    const unitDistance = units.find(u => u.id === unitId)?.distance_km ?? null;
    const clientDistance = clients.find(c => c.id === clientId)?.distance_km ?? null;
    // Local avulso (quando ativo) tem prioridade; senão unidade; fallback cliente.
    const distanceForFreight = (useAdhocLocation ? adhocDistance : unitDistance) ?? clientDistance ?? 0;
    const freightPerComp = (distanceForFreight || 0) * deliveryTrips * costPerKm;

    const perComp: Record<string, {
      totalWeightG: number; totalCost: number; totalItemCount: number;
      weightPerPerson: number; costPerPerson: number; suggestedPrice: number; pricePerPerson: number;
      profit: number; marginPct: number; freight: number;
      people: number;
    }> = {};

    let grandWeightG = 0;
    let grandCost = 0;
    let grandItemCount = 0;
    let grandRevenue = 0;
    let grandFreight = 0;

    compositions.forEach(c => {
      const people = peopleFor(c);
      let weightG = 0, cost = 0, revenue = 0, itemCount = 0;
      const sections = items[c.localId] || {};
      Object.values(sections).forEach(sec => {
        Object.values(sec).forEach(line => {
          const mat = materials.find(m => m.id === line.material_id);
          if (!mat) return;
          const effectiveQty = line.use_per_person ? line.qty_per_person * people : line.fixed_qty;
          weightG   += effectiveQty * mat.unit_weight;
          cost      += effectiveQty * mat.average_price;
          revenue   += effectiveQty * mat.sale_price;   // preço de venda por produto
          itemCount += effectiveQty;
        });
      });
      // Frete embutido (repasse): entra no custo E na receita → preço sobe, margem da comida intacta.
      cost    += freightPerComp;
      revenue += freightPerComp;
      const profit = revenue - cost;
      perComp[c.localId] = {
        totalWeightG: weightG,
        totalCost: cost,
        totalItemCount: itemCount,
        weightPerPerson: weightG / people,
        costPerPerson: cost / people,
        suggestedPrice: revenue,
        pricePerPerson: revenue / people,
        profit,
        marginPct: revenue > 0 ? profit / revenue : 0,
        freight: freightPerComp,
        people,
      };
      grandWeightG   += weightG;
      grandCost      += cost;
      grandItemCount += itemCount;
      grandRevenue   += revenue;
      grandFreight   += freightPerComp;
    });

    const grandProfit = grandRevenue - grandCost;
    return {
      perComp,
      grand: {
        totalWeightG: grandWeightG,
        totalCost: grandCost,
        totalItemCount: grandItemCount,
        suggestedPrice: grandRevenue,
        profit: grandProfit,
        marginPct: grandRevenue > 0 ? grandProfit / grandRevenue : 0,
        freight: grandFreight,
        // peso/pessoa de referência usa nº de pessoas da proposta
        weightPerPerson: grandWeightG / numPeople,
        costPerPerson: grandCost / numPeople,
        pricePerPerson: grandRevenue / numPeople,
      },
    };
  }, [items, materials, compositions, numPeople, clientId, clients, unitId, units, useAdhocLocation, adhocDistance, deliveryTrips, costPerKm]);

  // ── Persistence ────────────────────────────────────────────────────────────

  const validate = () => {
    if (!clientId)       { toast.error('Selecione o cliente');           return false; }
    if (!eventCategory)  { toast.error('Selecione a categoria do evento'); return false; }
    if (!numberOfPeople) { toast.error('Informe o número de pessoas');   return false; }
    return true;
  };

  const persistAll = async (status: string) => {
    if (!validate()) return null;

    const proposalPayload: any = {
      client_id:                clientId,
      department_id:            departmentId || null,
      unit_id:                  useAdhocLocation ? null : (unitId || null),
      room_id:                  useAdhocLocation ? null : (roomId || null),
      contact_id:               contactId    || null,
      // Local avulso (quando ativo)
      event_location_name:        useAdhocLocation ? (adhocName || null) : null,
      event_location_zip:         useAdhocLocation ? (adhocZip || null)  : null,
      event_location_distance_km: useAdhocLocation ? adhocDistance       : null,
      event_category:           eventCategory,
      event_date:               eventDate    || null,
      proposal_date:            proposalDate,
      proposal_kind:            'event_table',
      number_of_people:         numberOfPeople,
      target_weight_per_person: calc.grand.weightPerPerson || 200,
      total_weight:             calc.grand.totalWeightG,
      total_amount:             calc.grand.suggestedPrice,
      total_cost:               calc.grand.totalCost,
      notes:                    notes        || null,
      status,
    };

    let pid = proposalId;

    if (pid) {
      const { error } = await supabase.from('proposals').update(proposalPayload).eq('id', pid);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('proposals').insert(proposalPayload).select().single();
      if (error) throw error;
      pid = data.id;
    }

    // Apagar categorias (cascata nos itens) e compositions existentes da proposta.
    await supabase.from('proposal_categories').delete().eq('proposal_id', pid);
    await supabase.from('proposal_compositions').delete().eq('proposal_id', pid);

    // Re-inserir cada composition + suas seções/itens.
    for (let ci = 0; ci < compositions.length; ci++) {
      const c = compositions[ci];
      const compStats = calc.perComp[c.localId];

      const { data: compRow, error: compErr } = await supabase
        .from('proposal_compositions')
        .insert({
          proposal_id: pid,
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
            proposal_id: pid,
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

    return pid;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const pid = await persistAll('Rascunho');
      if (!pid) return;  // validação falhou (toast já exibido) — não reportar sucesso
      toast.success('Proposta salva!');
      onComplete();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (calc.grand.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
    try {
      setApproving(true);
      const pid = await persistAll('Aprovada');
      if (!pid) return;

      const { error: evtErr } = await (supabase.rpc as any)('create_event_from_proposal', { p_proposal_id: pid });
      if (evtErr) console.warn('create_event_from_proposal:', evtErr.message);

      const { error: prodErr } = await (supabase.rpc as any)('generate_production_from_proposal', { p_proposal_id: pid });
      if (prodErr) console.warn('generate_production_from_proposal:', prodErr.message);

      toast.success('Proposta aprovada! Evento e ordem de produção criados.');
      onComplete();
    } catch (e: any) {
      toast.error('Erro ao aprovar: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  const handleSend = async () => {
    if (calc.grand.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
    try {
      setSending(true);
      // Salva a proposta como 'Enviada'
      const pid = await persistAll('Enviada');
      if (!pid) return;

      // Gera o token de aprovação e monta o link público
      const { data: tok, error: tokErr } = await supabase
        .from('proposal_approval_tokens')
        .insert({ proposal_id: pid })
        .select('token')
        .single();
      if (tokErr) throw tokErr;

      const url = `${window.location.origin}/aprovar/${tok.token}`;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard pode falhar; link no toast */ }

      toast.success('Proposta enviada! Link copiado — cole no e-mail/WhatsApp para o cliente aprovar.', {
        duration: 8000,
        description: url,
      });
      onComplete();
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getClientDisplay = (c: Client) => c.fantasy_name || c.name;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{isNew ? 'Nova Proposta' : 'Editar Proposta'}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preencha os dados do evento e monte a composição
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: form + composition ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Dados do Evento */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Dados do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-1.5">
                  <Label>Cliente *</Label>
                  <Select value={clientId} onValueChange={handleClientChange}>
                    <SelectTrigger className={!clientId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{getClientDisplay(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Categoria do evento */}
                <div className="space-y-1.5">
                  <Label>Categoria do Evento *</Label>
                  <Select value={eventCategory} onValueChange={setEventCategory}>
                    <SelectTrigger className={!eventCategory ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data do evento */}
                <div className="space-y-1.5">
                  <Label>Data do Evento</Label>
                  <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                </div>

                {/* Data da proposta */}
                <div className="space-y-1.5">
                  <Label>Data da Proposta *</Label>
                  <Input type="date" value={proposalDate} onChange={e => setProposalDate(e.target.value)} />
                </div>

                {/* Número de pessoas */}
                <div className="space-y-1.5">
                  <Label>Número de Pessoas *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numberOfPeople || ''}
                    placeholder="Ex: 50"
                    onChange={e => setNumberOfPeople(parseInt(e.target.value) || 0)}
                    className={!numberOfPeople ? 'border-destructive' : ''}
                  />
                </div>

                {/* Observações */}
                <div className="space-y-1.5 md:col-span-1">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações sobre o evento..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Estrutura do cliente (só aparece quando cliente selecionado) */}
              {clientId && (
                <div className="pt-2 border-t space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Estrutura do Cliente {loadingStructure && '· carregando...'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Departamento</Label>
                      <Select value={departmentId} onValueChange={setDepartmentId} disabled={!departments.length}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder={departments.length ? 'Selecione' : 'Nenhum'} />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unidade</Label>
                      <Select value={unitId} onValueChange={setUnitId} disabled={!units.length}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder={units.length ? 'Selecione' : 'Nenhuma'} />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sala</Label>
                      <Select value={roomId} onValueChange={setRoomId} disabled={!filteredRooms.length}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder={filteredRooms.length ? 'Selecione' : 'Nenhuma'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contato</Label>
                      <Select value={contactId} onValueChange={setContactId} disabled={!filteredContacts.length}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder={filteredContacts.length ? 'Selecione' : 'Nenhum'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Local avulso — evento em endereço que não é unidade do cliente */}
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useAdhocLocation}
                        onCheckedChange={(v) => {
                          setUseAdhocLocation(v);
                          if (v) { setUnitId(''); setRoomId(''); }  // avulso substitui unidade/sala
                          else { setAdhocDistance(null); }
                        }}
                      />
                      <Label className="text-xs">
                        Local avulso (salão alugado / endereço fora das unidades do cliente)
                      </Label>
                    </div>
                    {useAdhocLocation && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs">Nome do local</Label>
                          <Input className="h-8 text-sm" value={adhocName}
                            onChange={(e) => setAdhocName(e.target.value)}
                            placeholder="Ex: Salão de Festas Recanto" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">CEP do local</Label>
                          <Input className="h-8 text-sm" value={adhocZip}
                            onChange={(e) => setAdhocZip(e.target.value)}
                            onBlur={async () => {
                              const cep = adhocZip.replace(/\D/g, '');
                              if (cep.length !== 8) return;
                              setAdhocCalculating(true);
                              const d = await computeDistanceKmFromCep(cep);
                              setAdhocCalculating(false);
                              if (d != null) setAdhocDistance(d);
                            }}
                            placeholder="00000-000" />
                          <span className="text-[10px] text-muted-foreground">
                            {adhocCalculating ? 'calculando distância…'
                              : adhocDistance != null ? `Distância: ${adhocDistance} km (estimada)`
                              : 'distância calculada pelo CEP'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Composição (multi-momento) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-base">Composição do Cardápio</h3>
              {numberOfPeople > 0 && (
                <span className="text-xs text-muted-foreground">· {numberOfPeople} pessoas</span>
              )}
            </div>

            {compositions.map((comp, compIdx) => {
              const compStats = calc.perComp[comp.localId];
              const people = compStats ? compStats.people : numPeople;

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
                              key={selected.join(',')}
                              placeholder={`Adicionar ${sec.label.toLowerCase()}...`}
                              searchPlaceholder="Buscar..."
                              emptyText="Não encontrado"
                              options={available.map(m => ({
                                value: m.id,
                                label: `${m.name}${m.unit_weight ? ` — ${m.unit_weight}g` : ''} — ${fmt(m.average_price)}/${m.usage_unit}`,
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
                              <div key={matId} className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-muted/20">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{mat.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {mat.unit_weight ? `${mat.unit_weight}g/un · ` : ''}{fmt(mat.average_price)}/{mat.usage_unit}
                                  </p>
                                </div>

                                {/* Toggle por pessoa / total */}
                                <div className="flex items-center gap-1 text-xs">
                                  <button
                                    onClick={() => updateLine(comp.localId, sec.key, matId, { use_per_person: true })}
                                    className={`px-2 py-1 rounded transition-colors ${line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                  >/pessoa</button>
                                  <button
                                    onClick={() => updateLine(comp.localId, sec.key, matId, { use_per_person: false })}
                                    className={`px-2 py-1 rounded transition-colors ${!line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                  >total</button>
                                </div>

                                {/* Quantity */}
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

                                {/* Line totals */}
                                <div className="text-xs text-right text-muted-foreground min-w-[90px]">
                                  {mat.unit_weight > 0 && <span className="block font-medium text-foreground">{totalW.toFixed(0)}g</span>}
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
                        <span className="text-muted-foreground">
                          Margem <span className={`font-semibold ${(compStats?.marginPct ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            {((compStats?.marginPct ?? 0) * 100).toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground"> · lucro {fmt(compStats?.profit || 0)}</span>
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
        </div>

        {/* ── Right: sticky summary ── */}
        <div className="xl:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Resumo da Proposta
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por pessoa</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Scale className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{calc.grand.weightPerPerson.toFixed(0)}g</p>
                      <p className="text-xs text-muted-foreground">Peso</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{fmt(calc.grand.costPerPerson)}</p>
                      <p className="text-xs text-muted-foreground">Custo</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Total ({compositions.length} {compositions.length === 1 ? 'composição' : 'composições'} · {numPeople} pessoa{numPeople !== 1 ? 's' : ''})
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peso total</span>
                      <span className="font-medium">{(calc.grand.totalWeightG / 1000).toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo total</span>
                      <span className="font-medium">{fmt(calc.grand.totalCost)}</span>
                    </div>
                    {calc.grand.freight > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">↳ Frete/logística (embutido, interno)</span>
                        <span className="text-muted-foreground">{fmt(calc.grand.freight)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Precificação (preço de venda por produto)
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor de venda</span>
                      <span className="font-bold text-primary text-base">{fmt(calc.grand.suggestedPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Por pessoa</span>
                      <span className="font-semibold">{fmt(calc.grand.pricePerPerson)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lucro</span>
                      <span className="font-semibold">{fmt(calc.grand.profit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margem</span>
                      <span className={`font-bold ${calc.grand.marginPct < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        {(calc.grand.marginPct * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 pt-1">
                  <Button className="w-full" variant="outline" onClick={handleSave} disabled={saving || approving || sending}>
                    {saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                      : <><Save className="h-4 w-4 mr-2" />Salvar rascunho</>
                    }
                  </Button>

                  <Button className="w-full" variant="secondary" onClick={handleSend} disabled={saving || approving || sending || calc.grand.totalItemCount === 0}>
                    {sending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                      : <><Send className="h-4 w-4 mr-2" />Enviar proposta</>
                    }
                  </Button>

                  <Button className="w-full" onClick={handleApprove} disabled={saving || approving || sending || calc.grand.totalItemCount === 0}>
                    {approving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aprovando...</>
                      : <><CheckCircle2 className="h-4 w-4 mr-2" />Aprovar proposta</>
                    }
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

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ProposalRevisions } from './ProposalRevisions';
import { toast } from 'sonner';
import {
  Plus, Minus, Save, ArrowLeft, X, Scale, DollarSign,
  CheckCircle2, Loader2, Users, Calendar, ChefHat, Trash2,
  CalendarClock, MapPin, Send, GlassWater,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; name: string; fantasy_name?: string | null; distance_km?: number | null; }
interface Department { id: string; name: string; }
interface Unit { id: string; name: string; distance_km?: number | null; }
interface Room { id: string; name: string; unit_id: string; }
interface Contact { id: string; name: string; department_id?: string | null; email?: string | null; }
interface PortalUser { user_id: string; name: string; email: string | null; portal_role: string; }

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
  event_category: string;     // tipo de evento DESTE momento (Coffee Break, Almoço…)
  scheduled_date: string;     // 'YYYY-MM-DD' ou ''
  scheduled_time: string;     // 'HH:MM' ou ''
  room_id: string;            // sala (estrutura do cliente) DESTE momento
  location: string;           // local livre (complemento/avulso) DESTE momento
  number_of_people: number | null; // nº de pessoas DESTE momento
  notes: string;
  service_code: string; // override raro do Código de Serviço padrão da empresa (config vendas.fiscal_service_code)
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

// ─── Data fetching (module-level, cacheável) ──────────────────────────────────

const EMPTY_CLIENTS: Client[] = [];
const EMPTY_MATERIALS: SellableMaterial[] = [];
const EMPTY_TAG_MAP: Record<string, Set<string>> = {};
const EMPTY_DEPARTMENTS: Department[] = [];
const EMPTY_UNITS: Unit[] = [];
const EMPTY_ROOMS: Room[] = [];
const EMPTY_CONTACTS: Contact[] = [];
const EMPTY_PORTAL_USERS: PortalUser[] = [];

async function fetchActiveClientsForProposal(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, fantasy_name, distance_km')
    .eq('status', 'Ativo')
    .order('name');
  if (error) throw error;
  return data || [];
}

// Parâmetros de logística (frete por evento) — globais em app_settings.
async function fetchProposalLogisticsParams() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['logistics.delivery_trips', 'logistics.cost_per_km']);
  if (error) throw error;
  const map = new Map((data || []).map((r: any) => [r.key, r.value]));
  return {
    deliveryTrips: parseFloat(map.get('logistics.delivery_trips') ?? '4') || 0,
    costPerKm: parseFloat(map.get('logistics.cost_per_km') ?? '1.50') || 0,
  };
}

async function fetchSellableMaterialsForProposal(): Promise<{ materials: SellableMaterial[]; tagMap: Record<string, Set<string>> }> {
  const { data: mats, error } = await supabase
    .from('materials')
    .select('id, code, name, category, subcategory, unit_weight, cost_price, usage_unit, practiced_price, suggested_price')
    .eq('is_sellable', true)
    .eq('is_archived', false)
    .order('name');
  if (error) throw error;
  if (!mats?.length) return { materials: [], tagMap: {} };

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
  const tagMap: Record<string, Set<string>> = {};
  tagRes.data?.forEach((t: any) => {
    const code = t.taxonomy_terms?.code;
    if (!code) return;
    if (!tagMap[t.material_id]) tagMap[t.material_id] = new Set();
    tagMap[t.material_id].add(code);
  });

  const materials = mats.map((m: any) => {
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
  });

  return { materials, tagMap };
}

async function fetchClientStructureForProposal(clientId: string) {
  const [deptR, unitR, roomR, contactR] = await Promise.all([
    supabase.from('client_departments').select('id, name').eq('client_id', clientId).eq('is_active', true).order('name'),
    supabase.from('client_units').select('id, name, distance_km').eq('client_id', clientId).eq('is_active', true).order('name'),
    supabase.from('client_rooms').select('id, name, unit_id').eq('client_id', clientId).eq('is_active', true).order('name'),
    supabase.from('client_contacts').select('id, name, department_id, email').eq('client_id', clientId).eq('is_active', true).order('name'),
  ]);

  // Usuários do portal deste cliente — usado só pra cruzar (por e-mail) se o contato
  // escolhido já tem acesso; o contato É o solicitante, não há mais campo separado.
  const cuR = await supabase.from('client_users')
    .select('user_id, portal_role').eq('client_id', clientId).eq('is_active', true);
  const ids = (cuR.data || []).map((r: any) => r.user_id);
  let profs: any[] = [];
  if (ids.length) {
    profs = (await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', ids)).data || [];
  }
  const pm = new Map(profs.map((p: any) => [p.user_id, p]));

  return {
    departments: deptR.data || [],
    units: unitR.data || [],
    rooms: roomR.data || [],
    contacts: contactR.data || [],
    portalUsers: (cuR.data || []).map((r: any) => ({
      user_id: r.user_id,
      name: pm.get(r.user_id)?.full_name || pm.get(r.user_id)?.email || 'Usuário',
      email: pm.get(r.user_id)?.email || null,
      portal_role: r.portal_role,
    })),
  };
}

async function fetchExistingProposalForEditor(id: string) {
  const { data: prop, error } = await supabase
    .from('proposals')
    .select('*, clients(name, fantasy_name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!prop) return null;

  const [compRes, catRes] = await Promise.all([
    supabase
      .from('proposal_compositions')
      .select('id, name, event_category, scheduled_date, scheduled_time, room_id, location, number_of_people, notes, sort_order, service_code')
      .eq('proposal_id', id)
      .order('sort_order'),
    supabase
      .from('proposal_categories')
      .select('id, category_label, composition_id, proposal_category_items(material_id, qty_per_person, fixed_qty, item_kind)')
      .eq('proposal_id', id),
  ]);

  return {
    prop,
    dbComps: compRes.data || [],
    dbCats: catRes.data || [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposalId, onComplete, onCancel }: ProposalEditorProps) {
  const isNew = !proposalId;
  const queryClient = useQueryClient();

  // ── Header form state ──────────────────────────────────────────────────────
  const [clientId, setClientId]             = useState('');
  const [eventName, setEventName]           = useState('');   // nome do evento guarda-chuva
  const [proposalDate, setProposalDate]     = useState(todayLocalISO());
  const [notes, setNotes]                   = useState('');
  const [departmentId, setDepartmentId]     = useState('');
  const [unitId, setUnitId]                 = useState('');   // unidade (endereço) — dirige o frete
  const [contactId, setContactId]           = useState('');
  // Local avulso (evento em endereço que não é unidade do cliente — ex.: salão alugado)
  const [useAdhocLocation, setUseAdhocLocation] = useState(false);
  const [adhocName, setAdhocName]               = useState('');
  const [adhocZip, setAdhocZip]                 = useState('');
  const [adhocDistance, setAdhocDistance]       = useState<number | null>(null);
  const [adhocCalculating, setAdhocCalculating] = useState(false);

  // Proposta guarda-chuva: aprovada uma vez, execuções lançadas depois via
  // add_umbrella_execution (ver ProposalUmbrellaPanel) — nunca reaberta aqui.
  const [isUmbrella, setIsUmbrella]                       = useState(false);
  const [umbrellaQuotaQuantity, setUmbrellaQuotaQuantity] = useState<number | null>(null);
  const [umbrellaQuotaUnitPrice, setUmbrellaQuotaUnitPrice] = useState<number | null>(null);

  // portal_created_by carregado de uma proposta existente — preservado no Salvar/Aprovar
  // quando o contato atual não resolve (ainda) pra um usuário de portal ativo; o envio
  // (handleSend) é quem de fato resolve/convida e sobrescreve via portalUserIdOverride.
  const [loadedPortalCreatedBy, setLoadedPortalCreatedBy] = useState<string | null>(null);

  // ── Composition state ──────────────────────────────────────────────────────
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
  const [saving, setSaving]     = useState(false);
  const [approving, setApproving] = useState(false);
  const [sending, setSending]   = useState(false);

  // ── Reference data (cacheável) ─────────────────────────────────────────────

  const { data: clients = EMPTY_CLIENTS, isPending: clientsLoading } = useQuery({
    queryKey: ['active-clients-list'],
    queryFn: fetchActiveClientsForProposal,
  });

  const { data: logisticsParams, isPending: logisticsLoading } = useQuery({
    queryKey: ['proposal-logistics-params'],
    queryFn: fetchProposalLogisticsParams,
  });
  const deliveryTrips = logisticsParams?.deliveryTrips ?? 4;
  const costPerKm = logisticsParams?.costPerKm ?? 1.5;

  const { data: materialsData, isPending: materialsLoading } = useQuery({
    queryKey: ['sellable-materials-for-proposal'],
    queryFn: fetchSellableMaterialsForProposal,
  });
  const materials = materialsData?.materials ?? EMPTY_MATERIALS;
  const tagMap = materialsData?.tagMap ?? EMPTY_TAG_MAP;

  const { data: clientStructure, isFetching: loadingStructure } = useQuery({
    queryKey: ['client-structure-for-proposal', clientId],
    queryFn: () => fetchClientStructureForProposal(clientId),
    enabled: !!clientId,
  });
  const departments = clientStructure?.departments ?? EMPTY_DEPARTMENTS;
  const units = clientStructure?.units ?? EMPTY_UNITS;
  const rooms = clientStructure?.rooms ?? EMPTY_ROOMS;
  const contacts = clientStructure?.contacts ?? EMPTY_CONTACTS;
  const portalUsers = clientStructure?.portalUsers ?? EMPTY_PORTAL_USERS;

  const { data: existingProposal, isPending: existingProposalLoading } = useQuery({
    queryKey: ['proposal-editor-existing', proposalId],
    queryFn: () => fetchExistingProposalForEditor(proposalId!),
    enabled: !!proposalId,
  });

  const loading = clientsLoading || logisticsLoading || materialsLoading
    || (!!proposalId && existingProposalLoading);

  // ── Seed do formulário local: proposta nova (composição default, uma vez) ──
  useEffect(() => {
    if (proposalId) return;
    setCompositions([{
      localId: 'c0',
      dbId: null,
      name: 'Momento 1',
      event_category: '',
      scheduled_date: '',
      scheduled_time: '',
      room_id: '',
      location: '',
      number_of_people: null,
      notes: '',
      service_code: '',
    }]);
    setItems({ c0: {} });
  }, [proposalId]);

  // ── Seed do formulário local: proposta existente, assim que a busca resolve ──
  useEffect(() => {
    if (!existingProposal?.prop) return;
    const { prop, dbComps, dbCats } = existingProposal;

    setClientId(prop.client_id || '');
    setEventName(prop.event_name || '');
    setProposalDate(prop.proposal_date || todayLocalISO());
    setNotes(prop.notes || '');
    setDepartmentId(prop.department_id || '');
    setUnitId(prop.unit_id || '');
    setContactId(prop.contact_id || '');
    setLoadedPortalCreatedBy(prop.portal_created_by || null);
    setIsUmbrella(!!prop.is_umbrella);
    setUmbrellaQuotaQuantity(prop.umbrella_quota_quantity ?? null);
    setUmbrellaQuotaUnitPrice(prop.umbrella_quota_unit_price ?? null);
    // Local avulso (se a proposta tiver CEP de local avulso gravado)
    const hasAdhoc = !!prop.event_location_zip || prop.event_location_distance_km != null;
    setUseAdhocLocation(hasAdhoc);
    setAdhocName(prop.event_location_name || '');
    setAdhocZip(prop.event_location_zip || '');
    setAdhocDistance(prop.event_location_distance_km ?? null);

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
        event_category: c.event_category || prop.event_category || '',
        scheduled_date: c.scheduled_date || '',
        scheduled_time: c.scheduled_time ? String(c.scheduled_time).slice(0, 5) : '',
        room_id: c.room_id || '',
        location: c.location || '',
        number_of_people: c.number_of_people ?? (prop.number_of_people || null),
        notes: c.notes || '',
        service_code: c.service_code || '',
      });
    });

    // Se não há compositions salvas mas há categorias legadas, ou nenhum dado,
    // garantir ao menos UMA composition default.
    if (!comps.length) {
      comps.push({
        localId: `c${seq++}`,
        dbId: null,
        name: 'Momento 1',
        event_category: prop?.event_category || '',
        scheduled_date: prop?.event_date || '',
        scheduled_time: '',
        room_id: prop?.room_id || '',
        location: '',
        number_of_people: prop?.number_of_people || null,
        notes: '',
        service_code: '',
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
  }, [existingProposal]);

  const handleClientChange = (id: string) => {
    setClientId(id);
    setDepartmentId(''); setUnitId(''); setContactId(''); setLoadedPortalCreatedBy(null);
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

  // O contato escolhido É o solicitante/dono da visibilidade no portal — cruzamento
  // por e-mail (case-insensitive) contra os usuários de portal já ativos deste cliente.
  const selectedContact = useMemo(() => contacts.find(c => c.id === contactId) || null, [contacts, contactId]);
  const resolvedPortalUser = useMemo(() => {
    if (!selectedContact?.email) return null;
    const email = selectedContact.email.trim().toLowerCase();
    if (!email) return null;
    return portalUsers.find(u => (u.email || '').trim().toLowerCase() === email) || null;
  }, [selectedContact, portalUsers]);
  const resolvedExistingPortalUserId = resolvedPortalUser?.user_id ?? null;

  // ── Handlers de composition ──────────────────────────────────────────────────

  const addComposition = () => {
    const localId = nextLocalId();
    setCompositions(prev => [...prev, {
      localId,
      dbId: null,
      name: `Momento ${prev.length + 1}`,
      event_category: '',
      scheduled_date: '',
      scheduled_time: '',
      room_id: '',
      location: '',
      number_of_people: null,
      notes: '',
      service_code: '',
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

  // Nº de pessoas TOTAL do evento = soma dos momentos (derivado). Não há mais um
  // nº de pessoas no cabeçalho — cada momento tem o seu.
  const totalPeople = useMemo(
    () => compositions.reduce((s, c) => s + (c.number_of_people && c.number_of_people > 0 ? c.number_of_people : 0), 0),
    [compositions]
  );
  const numPeople = totalPeople || 1;

  const calc = useMemo(() => {
    const peopleFor = (c: Composition) =>
      (c.number_of_people && c.number_of_people > 0) ? c.number_of_people : 0;

    // Frete por composição (delivery) = distância × nº trajetos × R$/km.
    // Distância vem da UNIDADE selecionada (cada local tem distância própria — ex.:
    // CMPC Guaíba ≠ Porto Alegre ≠ Barra do Ribeiro); fallback na distância do cliente.
    const unitDistance = units.find(u => u.id === unitId)?.distance_km ?? null;
    const clientDistance = clients.find(c => c.id === clientId)?.distance_km ?? null;
    // Local avulso (quando ativo) tem prioridade; senão unidade; fallback cliente.
    const distanceForFreight = (useAdhocLocation ? adhocDistance : unitDistance) ?? clientDistance ?? 0;
    const freightPerComp = (distanceForFreight || 0) * deliveryTrips * costPerKm;

    // Comida é medida em PESO (g) e bebida em VOLUME (mL). O unit_weight do material
    // guarda o conteúdo por unidade de uso (g p/ comida, mL p/ bebida — vindo da ficha).
    const isBeverage = (mat: SellableMaterial) => mat.category === 'Bebidas';

    const perComp: Record<string, {
      totalWeightG: number; totalBevMl: number; totalCost: number; totalItemCount: number;
      foodGPerPerson: number; bevMlPerPerson: number;
      costPerPerson: number; suggestedPrice: number; pricePerPerson: number;
      profit: number; marginPct: number; freight: number;
      people: number;
    }> = {};

    let grandWeightG = 0;
    let grandBevMl = 0;
    let grandCost = 0;
    let grandItemCount = 0;
    let grandRevenue = 0;
    let grandFreight = 0;

    compositions.forEach(c => {
      const people = peopleFor(c);
      let foodG = 0, bevMl = 0, cost = 0, revenue = 0, itemCount = 0;
      const sections = items[c.localId] || {};
      Object.values(sections).forEach(sec => {
        Object.values(sec).forEach(line => {
          const mat = materials.find(m => m.id === line.material_id);
          if (!mat) return;
          const effectiveQty = line.use_per_person ? line.qty_per_person * people : line.fixed_qty;
          if (isBeverage(mat)) bevMl += effectiveQty * mat.unit_weight;   // volume (mL)
          else                 foodG += effectiveQty * mat.unit_weight;   // peso (g)
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
        totalWeightG: foodG,
        totalBevMl: bevMl,
        totalCost: cost,
        totalItemCount: itemCount,
        foodGPerPerson: foodG / (people || 1),
        bevMlPerPerson: bevMl / (people || 1),
        costPerPerson: cost / (people || 1),
        suggestedPrice: revenue,
        pricePerPerson: revenue / (people || 1),
        profit,
        marginPct: revenue > 0 ? profit / revenue : 0,
        freight: freightPerComp,
        people,
      };
      grandWeightG   += foodG;
      grandBevMl     += bevMl;
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
        totalBevMl: grandBevMl,
        totalCost: grandCost,
        totalItemCount: grandItemCount,
        suggestedPrice: grandRevenue,
        profit: grandProfit,
        marginPct: grandRevenue > 0 ? grandProfit / grandRevenue : 0,
        freight: grandFreight,
        // médias de referência usam o nº total de pessoas (soma dos momentos)
        weightPerPerson: grandWeightG / numPeople,
        bevMlPerPerson: grandBevMl / numPeople,
        costPerPerson: grandCost / numPeople,
        pricePerPerson: grandRevenue / numPeople,
      },
    };
  }, [items, materials, compositions, numPeople, clientId, clients, unitId, units, useAdhocLocation, adhocDistance, deliveryTrips, costPerKm]);

  // ── Persistence ────────────────────────────────────────────────────────────

  const validate = () => {
    if (!clientId)  { toast.error('Selecione o cliente');     return false; }
    if (!eventName.trim()) { toast.error('Informe o nome do evento'); return false; }
    if (!compositions.length) { toast.error('Adicione ao menos um momento'); return false; }
    // Guarda-chuva: 1 momento único (a composição-molde). As ocorrências reais
    // entram depois da aprovação, pelo painel "Saldo e execuções" — permitir
    // vários momentos aqui tornaria ambíguo qual é o molde copiado nas execuções.
    if (isUmbrella && compositions.length > 1) {
      toast.error('Proposta guarda-chuva usa um único momento (a composição-molde). As execuções reais são lançadas após a aprovação, em "Saldo e execuções".');
      return false;
    }
    for (let i = 0; i < compositions.length; i++) {
      const c = compositions[i];
      if (!c.event_category) { toast.error(`Selecione o tipo de evento do momento ${i + 1}`); return false; }
      if (!c.number_of_people || c.number_of_people <= 0) { toast.error(`Informe o nº de pessoas do momento ${i + 1}`); return false; }
    }
    return true;
  };

  const persistAll = async (status: string, opts?: { portalUserIdOverride?: string }) => {
    if (!validate()) return null;

    // Campos legados de cabeçalho derivados dos momentos (mantidos p/ PDF/lista/RPCs):
    //  event_category = tipo do 1º momento; event_date = menor data; number_of_people = soma.
    const derivedEventCategory = compositions[0]?.event_category || null;
    const compDates = compositions.map(c => c.scheduled_date).filter(Boolean).sort();
    const derivedEventDate = compDates[0] || null;

    // Guarda-chuva: o valor comercial da proposta é a cota contratada (qtd ×
    // preço de referência, caindo pro preço da composição-molde quando o campo
    // fica em branco — mesma cadeia de fallback de add_umbrella_execution), não
    // o total da molde. É o que a lista/funil/portal/PDF mostram como total.
    const moldePricePerPerson = calc.perComp[compositions[0]?.localId]?.pricePerPerson ?? 0;
    const umbrellaEffectiveUnitPrice = umbrellaQuotaUnitPrice ?? (moldePricePerPerson > 0 ? moldePricePerPerson : null);
    const umbrellaContractTotal = isUmbrella && umbrellaQuotaQuantity && umbrellaEffectiveUnitPrice != null
      ? umbrellaQuotaQuantity * umbrellaEffectiveUnitPrice
      : null;

    const proposalPayload: any = {
      client_id:                clientId,
      event_name:               eventName.trim(),
      department_id:            departmentId || null,
      unit_id:                  useAdhocLocation ? null : (unitId || null),
      room_id:                  null, // sala agora é por momento
      contact_id:               contactId    || null,
      // O contato é o solicitante/dono da visibilidade no portal. O override existe porque,
      // no envio (handleSend), o usuário resolvido/convidado só existe depois de uma chamada
      // assíncrona — não dá pra confiar no estado já carregado (resolvedExistingPortalUserId)
      // nesse instante. Fora do envio, preserva o valor já gravado se o contato atual ainda
      // não resolve pra nenhum usuário de portal ativo (evita apagar o vínculo ao só salvar).
      portal_created_by:        opts?.portalUserIdOverride ?? resolvedExistingPortalUserId ?? loadedPortalCreatedBy ?? null,
      // Local avulso (quando ativo)
      event_location_name:        useAdhocLocation ? (adhocName || null) : null,
      event_location_zip:         useAdhocLocation ? (adhocZip || null)  : null,
      event_location_distance_km: useAdhocLocation ? adhocDistance       : null,
      event_category:           derivedEventCategory,
      event_date:               derivedEventDate,
      proposal_date:            proposalDate,
      proposal_kind:            'event_table',
      number_of_people:         totalPeople,
      target_weight_per_person: calc.grand.weightPerPerson || 200,
      total_weight:             calc.grand.totalWeightG,
      total_amount:             umbrellaContractTotal ?? calc.grand.suggestedPrice,
      total_cost:               calc.grand.totalCost,
      notes:                    notes        || null,
      is_umbrella:              isUmbrella,
      umbrella_quota_quantity:  isUmbrella ? umbrellaQuotaQuantity : null,
      umbrella_quota_unit_price: isUmbrella ? umbrellaQuotaUnitPrice : null,
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
          name: c.name || `Momento ${ci + 1}`,
          event_category: c.event_category || null,
          scheduled_date: c.scheduled_date || null,
          scheduled_time: c.scheduled_time || null,
          room_id: c.room_id || null,
          location: c.location || null,
          number_of_people: c.number_of_people ?? null,
          price_per_person: compStats ? compStats.pricePerPerson : 0,
          sort_order: ci + 1,
          notes: c.notes || null,
          service_code: c.service_code.trim() || null,
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
      const { error: prodErr } = await (supabase.rpc as any)('generate_production_from_proposal', { p_proposal_id: pid });

      // Erro aqui NÃO pode ser silencioso: a proposta já está 'Aprovada', mas sem
      // evento/ordens — o usuário precisa saber que a geração falhou.
      if (evtErr || prodErr) {
        toast.error(`Proposta aprovada, mas a geração de evento/produção falhou: ${(evtErr || prodErr)!.message}`);
      } else {
        toast.success(isUmbrella
          ? 'Proposta aprovada! Contrato guarda-chuva ativado — lance as execuções em "Saldo e execuções".'
          : 'Proposta aprovada! Evento e ordem de produção criados.');
      }
      onComplete();
    } catch (e: any) {
      toast.error('Erro ao aprovar: ' + e.message);
    } finally {
      setApproving(false);
    }
  };

  const handleSend = async () => {
    if (calc.grand.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
    if (!contactId) { toast.error('Selecione o contato/solicitante do portal'); return; }
    const contact = contacts.find(c => c.id === contactId);
    if (!contact?.email) {
      toast.error('O contato selecionado não tem e-mail cadastrado — informe um e-mail no cadastro do cliente para poder enviar pelo portal.');
      return;
    }
    try {
      setSending(true);

      // Acesso ao portal é sempre pelo contato escolhido. Se ele já tem conta ativa
      // (cruzada por e-mail), reaproveita; senão convida automaticamente agora.
      let portalUserIdResolved = resolvedExistingPortalUserId;
      if (!portalUserIdResolved) {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-client-user', {
          body: { email: contact.email, full_name: contact.name, client_id: clientId, portal_role: 'aprovador' },
        });
        if (inviteError) throw inviteError;
        if ((inviteData as any)?.error) { toast.error((inviteData as any).error); return; }
        portalUserIdResolved = (inviteData as any)?.user_id;
        if (!portalUserIdResolved) { toast.error('Não foi possível criar o acesso do contato ao portal.'); return; }
      }

      // Salva a proposta como 'Enviada', já com o solicitante resolvido/convidado.
      const pid = await persistAll('Enviada', { portalUserIdOverride: portalUserIdResolved });
      if (!pid) return;

      // Revisão: cada envio incrementa o contador e grava um snapshot (auditoria).
      const { count } = await supabase
        .from('proposal_revisions')
        .select('id', { count: 'exact', head: true })
        .eq('proposal_id', pid);
      const nextRevision = (count ?? 0) + 1;
      await supabase.from('proposals').update({ revision: nextRevision }).eq('id', pid);

      const snapshot = {
        event_name: eventName,
        event_category: compositions[0]?.event_category || null,
        number_of_people: totalPeople,
        totals: {
          revenue: calc.grand.suggestedPrice,
          cost: calc.grand.totalCost,
          weight: calc.grand.totalWeightG,
          freight: calc.grand.freight,
        },
        compositions: compositions.map(c => {
          const cs = calc.perComp[c.localId];
          const secs = items[c.localId] || {};
          return {
            name: c.name,
            event_category: c.event_category || null,
            scheduled_date: c.scheduled_date || null,
            people: cs?.people ?? null,
            price_per_person: cs?.pricePerPerson ?? null,
            items: Object.entries(secs).flatMap(([secKey, lines]: any) =>
              Object.values(lines).map((l: any) => {
                const m = materials.find(mm => mm.id === l.material_id);
                return {
                  section: secKey,
                  material: m?.name ?? l.material_id,
                  qty_per_person: l.use_per_person ? l.qty_per_person : null,
                  fixed_qty: !l.use_per_person ? l.fixed_qty : null,
                };
              })
            ),
          };
        }),
      };
      await supabase.from('proposal_revisions').insert({
        proposal_id: pid,
        revision: nextRevision,
        total_amount: calc.grand.suggestedPrice,
        total_cost: calc.grand.totalCost,
        total_weight: calc.grand.totalWeightG,
        number_of_people: totalPeople,
        event_date: compositions.map(c => c.scheduled_date).filter(Boolean).sort()[0] || null,
        status: 'Enviada',
        notes: notes || null,
        data: snapshot,
      });

      // Notifica o solicitante por e-mail — acesso é sempre pelo Portal autenticado,
      // não há mais link público sem login.
      const { error: notifyErr } = await supabase.functions.invoke('notify-portal-proposal', {
        body: { proposal_id: pid },
      });
      if (notifyErr) console.warn('notify-portal-proposal:', notifyErr.message);

      // Estrutura do cliente pode ter mudado (novo acesso de portal recém-criado).
      await queryClient.invalidateQueries({ queryKey: ['client-structure-for-proposal', clientId] });

      toast.success(`Proposta enviada (Rev. ${nextRevision})! ${contact.name} foi notificado(a) por e-mail e pode acompanhar/aprovar pelo Portal.`);
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
        <div className="flex items-center gap-2">
          {!isNew && proposalId && <ProposalRevisions proposalId={proposalId} />}
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
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

                {/* Nome do evento (guarda-chuva) */}
                <div className="space-y-1.5">
                  <Label>Nome do Evento *</Label>
                  <Input
                    value={eventName}
                    placeholder="Ex: Onboarding Turma 12"
                    onChange={e => setEventName(e.target.value)}
                    className={!eventName.trim() ? 'border-destructive' : ''}
                  />
                </div>

                {/* Data da proposta */}
                <div className="space-y-1.5">
                  <Label>Data da Proposta *</Label>
                  <Input type="date" value={proposalDate} onChange={e => setProposalDate(e.target.value)} />
                </div>

                {/* Total de pessoas (derivado dos momentos) */}
                <div className="space-y-1.5">
                  <Label>Total de Pessoas</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm text-muted-foreground">
                    {totalPeople > 0
                      ? `${totalPeople} (soma dos momentos)`
                      : 'definido por momento'}
                  </div>
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

              {/* Proposta guarda-chuva: cota total, execuções lançadas depois (fora deste editor) */}
              <div className="pt-2 border-t space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="is-umbrella" checked={isUmbrella} onCheckedChange={setIsUmbrella} />
                  <Label htmlFor="is-umbrella" className="cursor-pointer">
                    Proposta guarda-chuva (execuções recorrentes)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aprovada uma vez com uma cota total; depois disso a equipe vai lançando as
                  execuções (ex.: coffee break mensal, visitas avulsas) direto na lista de
                  propostas, sem reabrir esta tela.
                </p>
                {isUmbrella && (() => {
                  const moldePrice = calc.perComp[compositions[0]?.localId]?.pricePerPerson ?? 0;
                  const effectivePrice = umbrellaQuotaUnitPrice ?? (moldePrice > 0 ? moldePrice : null);
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Quantidade contratada</Label>
                          <Input
                            type="number" min="0"
                            value={umbrellaQuotaQuantity ?? ''}
                            onChange={e => setUmbrellaQuotaQuantity(e.target.value ? Number(e.target.value) : null)}
                            placeholder="Ex: 1000"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Preço de referência por unidade (R$)</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={umbrellaQuotaUnitPrice ?? ''}
                            onChange={e => setUmbrellaQuotaUnitPrice(e.target.value ? Number(e.target.value) : null)}
                            placeholder={moldePrice > 0 ? moldePrice.toFixed(2) : 'Ex: 18'}
                          />
                          {umbrellaQuotaUnitPrice == null && moldePrice > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Em branco: usa o preço por pessoa da composição ({fmt(moldePrice)}).{' '}
                              <button
                                type="button"
                                className="underline text-primary"
                                onClick={() => setUmbrellaQuotaUnitPrice(Number(moldePrice.toFixed(2)))}
                              >
                                Usar esse preço
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                      {umbrellaQuotaQuantity && effectivePrice != null ? (
                        <p className="text-sm bg-muted/50 rounded-md px-3 py-2">
                          Valor total contratado:{' '}
                          <span className="text-muted-foreground">{umbrellaQuotaQuantity} × {fmt(effectivePrice)} =</span>{' '}
                          <span className="font-bold text-primary">{fmt(umbrellaQuotaQuantity * effectivePrice)}</span>
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              {/* Estrutura do cliente (só aparece quando cliente selecionado) */}
              {clientId && (
                <div className="pt-2 border-t space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Estrutura do Cliente {loadingStructure && '· carregando...'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                      <Label className="text-xs">Contato / Solicitante do Portal</Label>
                      <Select value={contactId} onValueChange={setContactId} disabled={!filteredContacts.length}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder={filteredContacts.length ? 'Selecione' : 'Nenhum'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedContact && (
                        resolvedPortalUser ? (
                          <p className={`text-[10px] ${resolvedPortalUser.portal_role === 'aprovador' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Já tem acesso ao portal (perfil: {resolvedPortalUser.portal_role})
                            {resolvedPortalUser.portal_role !== 'aprovador' && ' — não poderá aprovar sozinho'}
                          </p>
                        ) : selectedContact.email ? (
                          <p className="text-[10px] text-muted-foreground">Ainda sem portal — será convidado(a) automaticamente ao enviar</p>
                        ) : (
                          <p className="text-[10px] text-destructive">Contato sem e-mail cadastrado — necessário para enviar pelo portal</p>
                        )
                      )}
                    </div>
                  </div>

                  {/* Local avulso — evento em endereço que não é unidade do cliente */}
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useAdhocLocation}
                        onCheckedChange={(v) => {
                          setUseAdhocLocation(v);
                          if (v) { setUnitId(''); }  // avulso substitui a unidade (endereço)
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
              {totalPeople > 0 && (
                <span className="text-xs text-muted-foreground">· {totalPeople} pessoas no total</span>
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
                            placeholder={`Momento ${compIdx + 1}`}
                            className="h-8 font-semibold text-base max-w-xs"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Tipo de Evento *</Label>
                            <Select
                              value={comp.event_category}
                              onValueChange={v => updateComposition(comp.localId, { event_category: v })}
                            >
                              <SelectTrigger className={`h-8 text-sm ${!comp.event_category ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {EVENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Nº de Pessoas *</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={comp.number_of_people ?? ''}
                              placeholder="Ex: 30"
                              onChange={e => updateComposition(comp.localId, { number_of_people: parseInt(e.target.value) || null })}
                              className={`h-8 text-sm ${!comp.number_of_people ? 'border-destructive' : ''}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Sala
                            </Label>
                            <Select
                              value={comp.room_id || 'none'}
                              onValueChange={v => updateComposition(comp.localId, { room_id: v === 'none' ? '' : v })}
                              disabled={!filteredRooms.length}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder={filteredRooms.length ? 'Selecione' : 'Selecione a unidade'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— sem sala —</SelectItem>
                                {filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
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
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Local (complemento)</Label>
                            <Input
                              value={comp.location}
                              onChange={e => updateComposition(comp.localId, { location: e.target.value })}
                              placeholder="Ex: detalhe do local"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Código de Serviço (override)</Label>
                            <Input
                              value={comp.service_code}
                              onChange={e => updateComposition(comp.localId, { service_code: e.target.value })}
                              placeholder="Padrão da empresa (deixe em branco)"
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
                          Comida/pessoa <span className="font-medium text-foreground">{Math.round(compStats?.foodGPerPerson || 0)} g</span>
                        </span>
                        {(compStats?.bevMlPerPerson || 0) > 0 && (
                          <span className="text-muted-foreground">
                            Bebida/pessoa <span className="font-medium text-foreground">{Math.round(compStats?.bevMlPerPerson || 0)} mL</span>
                          </span>
                        )}
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por pessoa (média do evento)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Scale className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{calc.grand.weightPerPerson.toFixed(0)}g</p>
                      <p className="text-xs text-muted-foreground">Comida</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <GlassWater className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{calc.grand.bevMlPerPerson.toFixed(0)}mL</p>
                      <p className="text-xs text-muted-foreground">Bebida</p>
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

import React, { useState, useEffect, useMemo } from 'react';
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
import { toast } from 'sonner';
import {
  Plus, Minus, Save, ArrowLeft, X, Scale, DollarSign,
  CheckCircle2, Loader2, Users, Calendar, ChefHat,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; name: string; fantasy_name?: string | null; }
interface Department { id: string; name: string; }
interface Unit { id: string; name: string; }
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
  usage_unit: string;
}

interface LineItem {
  material_id: string;
  qty_per_person: number;
  use_per_person: boolean;
  fixed_qty: number;
}

interface CategoryState {
  [materialId: string]: LineItem;
}

interface ProposalEditorProps {
  proposalId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN_TARGET = 0.40;

const PREFERRED_ORDER = ['Salgados', 'Doces & Confeitaria', 'Bebidas'];

const CATEGORY_COLORS: Record<string, string> = {
  'Salgados':            'bg-red-100 text-red-800 border-red-200',
  'Doces & Confeitaria': 'bg-pink-100 text-pink-800 border-pink-200',
  'Bebidas':             'bg-blue-100 text-blue-800 border-blue-200',
};
const DEFAULT_COLOR = 'bg-gray-100 text-gray-800 border-gray-200';

const EVENT_CATEGORIES = [
  'Coffee Break', 'Brunch', 'Coquetel', 'Almoco',
  'Jantar', 'Festa Infantil', 'Casamento', 'Reuniao Corporativa',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalEditor({ proposalId, onComplete, onCancel }: ProposalEditorProps) {
  const isNew = !proposalId;

  // ── Header form state ──────────────────────────────────────────────────────
  const [clientId, setClientId]             = useState('');
  const [eventCategory, setEventCategory]   = useState('');
  const [eventDate, setEventDate]           = useState('');
  const [proposalDate, setProposalDate]     = useState(new Date().toISOString().split('T')[0]);
  const [numberOfPeople, setNumberOfPeople] = useState<number>(0);
  const [notes, setNotes]                   = useState('');
  const [departmentId, setDepartmentId]     = useState('');
  const [unitId, setUnitId]                 = useState('');
  const [roomId, setRoomId]                 = useState('');
  const [contactId, setContactId]           = useState('');

  // ── Reference data ─────────────────────────────────────────────────────────
  const [clients, setClients]         = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits]             = useState<Unit[]>([]);
  const [rooms, setRooms]             = useState<Room[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // ── Composition state ──────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<SellableMaterial[]>([]);
  const [items, setItems]         = useState<Record<string, CategoryState>>({});

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [approving, setApproving] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => { bootstrap(); }, [proposalId]);

  const bootstrap = async () => {
    setLoading(true);
    try {
      await Promise.all([loadClients(), loadMaterials()]);

      if (proposalId) {
        await loadExistingProposal(proposalId);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, fantasy_name')
      .eq('status', 'Ativo')
      .order('name');
    setClients(data || []);
  };

  const loadMaterials = async () => {
    const { data: mats } = await supabase
      .from('materials')
      .select('id, code, name, category, subcategory, unit_weight, cost_price, usage_unit')
      .eq('is_sellable', true)
      .eq('is_archived', false)
      .order('name');

    if (!mats?.length) return;

    const matIds = mats.map((m: any) => m.id);
    const [stockRes, bomRes] = await Promise.all([
      supabase.from('stock_items').select('material_id, average_price').in('material_id', matIds),
      supabase.from('recipes_bom').select('finished_material_id, cached_unit_cost').in('finished_material_id', matIds),
    ]);

    const stockMap: Record<string, number> = {};
    stockRes.data?.forEach((s: any) => { stockMap[s.material_id] = parseFloat(s.average_price || 0); });

    const bomMap: Record<string, number> = {};
    bomRes.data?.forEach((b: any) => { bomMap[b.finished_material_id] = parseFloat(b.cached_unit_cost || 0); });

    setMaterials(mats.map((m: any) => ({
      ...m,
      unit_weight:   parseFloat(m.unit_weight || 0),
      cost_price:    parseFloat(m.cost_price  || 0),
      average_price: bomMap[m.id] || stockMap[m.id] || parseFloat(m.cost_price || 0),
    })));
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
    setProposalDate(prop.proposal_date || new Date().toISOString().split('T')[0]);
    setNumberOfPeople(prop.number_of_people || 0);
    setNotes(prop.notes || '');
    setDepartmentId(prop.department_id || '');
    setUnitId(prop.unit_id || '');
    setRoomId(prop.room_id || '');
    setContactId(prop.contact_id || '');

    if (prop.client_id) loadClientStructure(prop.client_id);

    // Load existing composition
    const { data: cats } = await supabase
      .from('proposal_categories')
      .select('id, category_label, proposal_category_items(material_id, qty_per_person, fixed_qty)')
      .eq('proposal_id', id);

    if (cats?.length) {
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
    }
  };

  const loadClientStructure = async (id: string) => {
    setLoadingStructure(true);
    try {
      const [deptR, unitR, roomR, contactR] = await Promise.all([
        supabase.from('client_departments').select('id, name').eq('client_id', id).eq('is_active', true).order('name'),
        supabase.from('client_units').select('id, name').eq('client_id', id).eq('is_active', true).order('name'),
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

  // ── Derived categories (dynamic, ordered) ─────────────────────────────────

  const categories = useMemo(() => {
    const unique = Array.from(new Set(materials.map(m => m.category).filter(Boolean)));
    return [
      ...PREFERRED_ORDER.filter(k => unique.includes(k)),
      ...unique.filter(k => !PREFERRED_ORDER.includes(k)).sort(),
    ];
  }, [materials]);

  const filteredRooms   = useMemo(() => unitId ? rooms.filter(r => r.unit_id === unitId) : rooms, [rooms, unitId]);
  const filteredContacts = useMemo(() => departmentId ? contacts.filter(c => !c.department_id || c.department_id === departmentId) : contacts, [contacts, departmentId]);

  // ── Composition handlers ───────────────────────────────────────────────────

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

  // ── Totals ─────────────────────────────────────────────────────────────────

  const numPeople = numberOfPeople || 1;

  const totals = useMemo(() => {
    let totalWeightG = 0, totalCost = 0, totalItemCount = 0;

    Object.values(items).forEach(cat => {
      Object.values(cat).forEach(line => {
        const mat = materials.find(m => m.id === line.material_id);
        if (!mat) return;
        const qty = line.use_per_person ? line.qty_per_person * numPeople : line.fixed_qty;
        totalWeightG   += qty * mat.unit_weight;
        totalCost      += qty * mat.average_price;
        totalItemCount += qty;
      });
    });

    return {
      totalWeightG,
      totalCost,
      totalItemCount,
      weightPerPerson:  totalWeightG / numPeople,
      costPerPerson:    totalCost    / numPeople,
      suggestedPrice:   totalCost    / (1 - MARGIN_TARGET),
      pricePerPerson:   (totalCost   / (1 - MARGIN_TARGET)) / numPeople,
    };
  }, [items, materials, numPeople]);

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
      unit_id:                  unitId       || null,
      room_id:                  roomId       || null,
      contact_id:               contactId    || null,
      event_category:           eventCategory,
      event_date:               eventDate    || null,
      proposal_date:            proposalDate,
      proposal_kind:            'event_table',
      number_of_people:         numberOfPeople,
      target_weight_per_person: totals.weightPerPerson || 200,
      total_weight:             totals.totalWeightG,
      total_amount:             totals.suggestedPrice,
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

    // Replace categories
    await supabase.from('proposal_categories').delete().eq('proposal_id', pid);

    for (const [catLabel, catItems] of Object.entries(items)) {
      if (!Object.keys(catItems).length) continue;
      const catOrder = categories.indexOf(catLabel) + 1;
      const { data: cat, error: catErr } = await supabase
        .from('proposal_categories')
        .insert({ proposal_id: pid, category_label: catLabel, sort_order: catOrder })
        .select().single();
      if (catErr) throw catErr;

      const rows = Object.values(catItems).map(line => ({
        category_id:    cat.id,
        material_id:    line.material_id,
        qty_per_person: line.use_per_person  ? line.qty_per_person : null,
        fixed_qty:      !line.use_per_person ? line.fixed_qty      : null,
        item_kind:      'produce_finished',
        unit_override:  null,
      }));
      const { error: itmErr } = await supabase.from('proposal_category_items').insert(rows);
      if (itmErr) throw itmErr;
    }

    return pid;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await persistAll('rascunho');
      toast.success('Proposta salva!');
      onComplete();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (totals.totalItemCount === 0) { toast.error('Adicione pelo menos um item'); return; }
    try {
      setApproving(true);
      const pid = await persistAll('aprovada');
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Composição */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-base">Composição do Cardápio</h3>
              {numberOfPeople > 0 && (
                <span className="text-xs text-muted-foreground">· {numberOfPeople} pessoas</span>
              )}
            </div>

            {categories.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  Nenhum produto vendável cadastrado. Cadastre produtos e ative a flag "Vendável".
                </CardContent>
              </Card>
            ) : (
              categories.map(catKey => {
                const catMats  = materials.filter(m => m.category === catKey);
                const selected = Object.keys(items[catKey] || {});
                const available = catMats.filter(m => !selected.includes(m.id));
                const color = CATEGORY_COLORS[catKey] || DEFAULT_COLOR;

                return (
                  <Card key={catKey}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Badge className={color}>{catKey}</Badge>
                        <span className="text-xs text-muted-foreground font-normal">
                          {catMats.length} disponíveis · {selected.length} selecionados
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {available.length > 0 && (
                        <Combobox
                          key={selected.join(',')}
                          placeholder={`Adicionar ${catKey.toLowerCase()}...`}
                          searchPlaceholder="Buscar..."
                          emptyText="Não encontrado"
                          options={available.map(m => ({
                            value: m.id,
                            label: `${m.name}${m.unit_weight ? ` — ${m.unit_weight}g` : ''} — ${fmt(m.average_price)}/${m.usage_unit}`,
                          }))}
                          onSelect={id => id && addMaterial(catKey, id)}
                        />
                      )}

                      {selected.map(matId => {
                        const mat  = materials.find(m => m.id === matId);
                        const line = items[catKey][matId];
                        if (!mat || !line) return null;

                        const qty      = line.use_per_person ? line.qty_per_person : line.fixed_qty;
                        const totalQty = line.use_per_person ? qty * numPeople : qty;
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
                                onClick={() => updateLine(catKey, matId, { use_per_person: true })}
                                className={`px-2 py-1 rounded transition-colors ${line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >/pessoa</button>
                              <button
                                onClick={() => updateLine(catKey, matId, { use_per_person: false })}
                                className={`px-2 py-1 rounded transition-colors ${!line.use_per_person ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >total</button>
                            </div>

                            {/* Quantity */}
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-7 w-7"
                                onClick={() => updateLine(catKey, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: Math.max(0, qty - 1) })}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number" min="0" value={qty}
                                onChange={e => updateLine(catKey, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: parseFloat(e.target.value) || 0 })}
                                className="w-16 h-7 text-center text-sm"
                              />
                              <Button variant="outline" size="icon" className="h-7 w-7"
                                onClick={() => updateLine(catKey, matId, { [line.use_per_person ? 'qty_per_person' : 'fixed_qty']: qty + 1 })}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Line totals */}
                            <div className="text-xs text-right text-muted-foreground min-w-[90px]">
                              {mat.unit_weight > 0 && <span className="block font-medium text-foreground">{totalW.toFixed(0)}g</span>}
                              <span>{fmt(totalC)}</span>
                            </div>

                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMaterial(catKey, matId)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}

                      {selected.length === 0 && catMats.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Nenhum produto cadastrado nesta categoria
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
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

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Total ({numPeople} pessoa{numPeople !== 1 ? 's' : ''})
                  </p>
                  <div className="space-y-1 text-sm">
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

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Precificação ({(MARGIN_TARGET * 100).toFixed(0)}% margem)
                  </p>
                  <div className="space-y-1 text-sm">
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

                <div className="space-y-2 pt-1">
                  <Button className="w-full" variant="outline" onClick={handleSave} disabled={saving || approving}>
                    {saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                      : <><Save className="h-4 w-4 mr-2" />Salvar rascunho</>
                    }
                  </Button>

                  <Button className="w-full" onClick={handleApprove} disabled={saving || approving || totals.totalItemCount === 0}>
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

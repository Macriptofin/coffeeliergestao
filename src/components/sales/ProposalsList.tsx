import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Copy, Ban, CheckCircle2, FileDown, Send, MoreHorizontal, FileText, CheckSquare, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';

interface Proposal {
  id: string;
  proposal_number: string;
  client_id: string;
  event_category: string;
  event_date: string;
  proposal_kind: string;
  number_of_people: number;
  total_amount: number;
  total_weight: number;
  revision: number;
  status: string;
  is_umbrella?: boolean;
  umbrella_closed_at?: string | null;      // contrato concluído/encerrado (fecha o saldo, não a cobrança)
  umbrella_close_reason?: 'concluido' | 'encerrado' | null;
  created_at: string;
  auto_generated_event_table_id?: string;
  auto_generated_bom_order_id?: string;
  generated_order_id?: string;
  clients?: {
    name: string;
  };
  portal_created_by?: string | null;
  created_by_client?: boolean;
  requester_name?: string | null; // nome do solicitante (usuário do portal), se houver
  // Pendências abertas vindas do portal (derivadas no fetch)
  pending_execution_requests?: number;
  pending_change_requests?: number;
  // Ciclo de vida (derivados dos eventos gerados, no fetch)
  events?: { id: string; event_date: string; status: string | null }[];
  next_delivery?: string | null;      // menor event_date futura (não cancelada)
  delivered?: boolean;                // tem eventos ativos e todos já passaram
  has_active_events?: boolean;        // tem algum evento não cancelado
  all_events_cancelled?: boolean;     // gerou eventos, mas todos foram cancelados
}

// Segmentos de fase de vida: negociação (rascunho/enviada/aceite do cliente),
// ativas (aprovadas com entrega pendente + contratos) e encerradas (histórico).
type Segment = 'negociacao' | 'ativa' | 'encerrada' | 'todas';

function lifecycleOf(p: Proposal): Exclude<Segment, 'todas'> {
  if (['Rascunho', 'Enviada', 'Aprovada pelo Cliente'].includes(p.status)) return 'negociacao';
  if (p.status === 'Aprovada') {
    // Contrato recorrente: ativo até ser concluído/encerrado pelo painel
    if (p.is_umbrella) return p.umbrella_closed_at ? 'encerrada' : 'ativa';
    // Avulsa cujos eventos foram TODOS cancelados: nada mais a entregar
    if (p.all_events_cancelled) return 'encerrada';
    // Avulsa é ativa enquanto tiver entrega futura ou ainda não gerou evento
    // (aprovada sem data definida).
    if (p.next_delivery || !p.delivered) return 'ativa';
    return 'encerrada'; // avulsa já entregue
  }
  return 'encerrada'; // Rejeitada / Cancelada
}

interface Props {
  onNewProposal: () => void;
  onEditProposal: (id: string) => void;
  onViewProposal: (id: string) => void;
  onPdfProposal?: (id: string) => void;
  onViewUmbrella?: (id: string) => void;
}

// Conjunto canônico de status (PT, capitalizado).
// 'Aprovada pelo Cliente' = aceite comercial do cliente, aguardando revisão final da equipe (destaque âmbar).
const statusOptions = [
  { value: 'Rascunho',              label: 'Rascunho',              variant: 'secondary',   className: '' },
  { value: 'Enviada',               label: 'Enviada',               variant: 'default',     className: '' },
  { value: 'Aprovada pelo Cliente', label: 'Aprovada pelo Cliente', variant: 'outline',     className: 'border-amber-300 bg-amber-100 text-amber-800' },
  { value: 'Aprovada',              label: 'Aprovada',              variant: 'success',      className: '' },
  { value: 'Rejeitada',             label: 'Rejeitada',             variant: 'destructive',  className: '' },
  { value: 'Cancelada',             label: 'Cancelada',             variant: 'outline',      className: '' },
];

const EMPTY_PROPOSALS: Proposal[] = [];

async function fetchProposals(): Promise<Proposal[]> {
  // Embeds trazem só as pendências ABERTAS (ids) — viram selos de "tem coisa
  // esperando a equipe" no card, sem precisar entrar em cada proposta.
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      clients (
        name
      ),
      umbrella_execution_requests (id, status),
      proposal_change_requests (id, status),
      events!events_proposal_id_fkey (id, event_date, status)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = ((data as any) || []) as Proposal[];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  rows.forEach((r: any) => {
    r.pending_execution_requests = (r.umbrella_execution_requests || []).filter((x: any) => x.status === 'aberta').length;
    r.pending_change_requests = (r.proposal_change_requests || []).filter((x: any) => x.status === 'aberta').length;
    // Ciclo de vida: eventos não cancelados definem próxima entrega / entregue
    const activeEvents = (r.events || []).filter((e: any) => e.status !== 'Cancelado' && e.event_date);
    const future = activeEvents.filter((e: any) => e.event_date >= todayStr).map((e: any) => e.event_date).sort();
    r.next_delivery = future[0] || null;
    r.delivered = activeEvents.length > 0 && future.length === 0;
    r.has_active_events = activeEvents.length > 0;
    r.all_events_cancelled = (r.events || []).length > 0 && activeEvents.length === 0;
  });
  // Enriquecer com o nome do solicitante (usuário do portal) quando houver.
  const ids = Array.from(new Set(rows.map(r => r.portal_created_by).filter(Boolean))) as string[];
  if (ids.length) {
    const { data: profs } = await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', ids);
    const pm = new Map((profs || []).map((p: any) => [p.user_id, p.full_name || p.email]));
    rows.forEach(r => { r.requester_name = r.portal_created_by ? (pm.get(r.portal_created_by) || 'Usuário do portal') : null; });
  }
  return rows;
}

export default function ProposalsList({ onNewProposal, onEditProposal, onViewProposal, onPdfProposal, onViewUmbrella }: Props) {
  const queryClient = useQueryClient();

  const {
    data: proposals = EMPTY_PROPOSALS,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['proposals'], queryFn: fetchProposals });

  const refetchProposals = () => queryClient.invalidateQueries({ queryKey: ['proposals'] });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar propostas');
  }, [isError]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('');
  const [kindFilter, setKindFilter] = useState(''); // '' | 'all' | 'single' | 'umbrella'
  const [segment, setSegment] = useState<Segment>('negociacao');

  const eventCategories = [
    'Coffee Break',
    'Brunch', 
    'Coquetel',
    'Almoco',
    'Jantar',
    'Festa Infantil',
    'Casamento',
    'Reuniao Corporativa'
  ];

  // Regra do sistema: nunca excluir, só desativar — cancelar preserva o
  // histórico (numeração, revisões, solicitações do portal) e manda a proposta
  // pro segmento "Encerradas".
  const handleCancelProposal = async (id: string) => {
    if (!confirm('Cancelar esta proposta? Ela vai para "Encerradas" e sai do fluxo ativo (nada é excluído).')) return;

    try {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'Cancelada' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Proposta cancelada.');
      refetchProposals();
    } catch (error) {
      console.error('Erro ao cancelar proposta:', error);
      toast.error('Erro ao cancelar proposta');
    }
  };

  const handleGenerateProduction = async (proposalId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_production_from_proposal', {
        p_proposal_id: proposalId
      });

      if (error) throw error;

      toast.success('Produção gerada com sucesso!');
      refetchProposals();
    } catch (error: any) {
      console.error('Erro ao gerar produção:', error);
      toast.error(error.message || 'Erro ao gerar produção');
    }
  };

  const handleConvertToOrder = async (proposalId: string) => {
    try {
      const { data, error } = await supabase.rpc('convert_proposal_to_order', {
        p_proposal_id: proposalId
      });

      if (error) throw error;

      toast.success('Proposta convertida em pedido com sucesso!');
      refetchProposals();
    } catch (error: any) {
      console.error('Erro ao converter proposta:', error);
      toast.error(error.message || 'Erro ao converter proposta em pedido');
    }
  };

  const handleApprove = async (proposalId: string) => {
    const isUmbrella = !!proposals.find(p => p.id === proposalId)?.is_umbrella;
    try {
      await supabase.from('proposals').update({ status: 'Aprovada' }).eq('id', proposalId);
      const { error: evtErr }  = await (supabase.rpc as any)('create_event_from_proposal',      { p_proposal_id: proposalId });
      const { error: prodErr } = await supabase.rpc('generate_production_from_proposal', { p_proposal_id: proposalId });
      // Erro aqui NÃO pode ser silencioso: a proposta já está 'Aprovada', mas
      // sem evento/ordens — o usuário precisa saber que a geração falhou.
      if (evtErr || prodErr) {
        toast.error(`Proposta aprovada, mas a geração de evento/produção falhou: ${(evtErr || prodErr)!.message}`);
      }
      // Notifica o solicitante do portal (se houver) — no-op silencioso pra propostas
      // sem portal_created_by (a própria função checa e retorna sem enviar nada).
      const { error: notifyErr } = await supabase.functions.invoke('notify-portal-proposal', {
        body: { proposal_id: proposalId, event_type: 'approved' },
      });
      if (notifyErr) console.warn('notify-portal-proposal:', notifyErr.message);
      toast.success(isUmbrella
        ? 'Proposta aprovada! Contrato guarda-chuva ativado — lance as execuções em "Saldo e execuções".'
        : 'Proposta aprovada! Evento e OP criados automaticamente.');
      refetchProposals();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aprovar proposta');
    }
  };

  const handleDuplicate = async (originalId: string) => {
    try {
      const { data: orig, error: fetchErr } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', originalId)
        .single();
      if (fetchErr) throw fetchErr;

      const { data: newProp, error: createErr } = await supabase
        .from('proposals')
        .insert({
          client_id:               orig.client_id,
          event_category:          (orig as any).event_category,
          event_date:              null,
          number_of_people:        orig.number_of_people,
          target_weight_per_person: orig.target_weight_per_person,
          total_weight:            orig.total_weight,
          total_amount:            orig.total_amount,
          status:                  'Rascunho',
          proposal_kind:           (orig as any).proposal_kind,
          department_id:           orig.department_id,
          contact_id:              orig.contact_id,
          unit_id:                 orig.unit_id,
        } as any)
        .select()
        .single();
      if (createErr) throw createErr;

      // Duplicar proposal_category_items
      const { data: cats } = await supabase
        .from('proposal_categories')
        .select('id, category_label, sort_order, proposal_category_items(*)')
        .eq('proposal_id', originalId);

      for (const cat of (cats || [])) {
        const { data: newCat } = await supabase
          .from('proposal_categories')
          .insert({ proposal_id: newProp.id, category_label: cat.category_label, sort_order: cat.sort_order })
          .select().single();
        if (newCat && cat.proposal_category_items?.length) {
          await supabase.from('proposal_category_items').insert(
            cat.proposal_category_items.map((it: any) => ({
              category_id: newCat.id, material_id: it.material_id,
              qty_per_person: it.qty_per_person, fixed_qty: it.fixed_qty, item_kind: it.item_kind,
            }))
          );
        }
      }

      toast.success('Proposta duplicada com sucesso!');
      refetchProposals();
    } catch (error) {
      console.error('Erro ao duplicar proposta:', error);
      toast.error('Erro ao duplicar proposta');
    }
  };

  const getStatusBadge = (proposal: Proposal) => {
    // Pedido que o próprio cliente montou e enviou pelo Portal — "Enviada" aqui
    // significa o oposto do caso padrão (equipe→cliente): é a equipe que precisa
    // analisar, não o cliente. Badge distinto pra não passar despercebido.
    if (proposal.status === 'Enviada' && proposal.created_by_client) {
      return (
        <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-800">
          Novo Pedido — Analisar
        </Badge>
      );
    }
    // Contrato concluído/encerrado: o desfecho diz mais que "Aprovada"
    if (proposal.status === 'Aprovada' && proposal.is_umbrella && proposal.umbrella_closed_at) {
      return proposal.umbrella_close_reason === 'concluido' ? (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
          Contrato concluído
        </Badge>
      ) : (
        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
          Contrato encerrado
        </Badge>
      );
    }
    // Avulsa aprovada cujos eventos foram todos cancelados: nada foi entregue
    if (proposal.status === 'Aprovada' && !proposal.is_umbrella && proposal.all_events_cancelled) {
      return (
        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
          Evento cancelado
        </Badge>
      );
    }
    // Avulsa aprovada com todos os eventos já realizados: "Entregue" diz mais
    // que "Aprovada" (é o que separa histórico de compromisso pendente).
    if (proposal.status === 'Aprovada' && !proposal.is_umbrella && proposal.delivered) {
      return (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
          Entregue
        </Badge>
      );
    }
    const statusOption = statusOptions.find(opt => opt.value === proposal.status);
    return (
      <Badge variant={statusOption?.variant as any || 'secondary'} className={statusOption?.className || ''}>
        {statusOption?.label || proposal.status}
      </Badge>
    );
  };

  // Contagens dos chips (sobre todas as propostas, independente dos filtros)
  const segmentCounts = proposals.reduce(
    (acc, p) => { acc[lifecycleOf(p)]++; return acc; },
    { negociacao: 0, ativa: 0, encerrada: 0 } as Record<Exclude<Segment, 'todas'>, number>
  );
  const segmentDefs: { key: Segment; label: string }[] = [
    { key: 'negociacao', label: 'Em negociação' },
    { key: 'ativa', label: 'Ativas' },
    { key: 'encerrada', label: 'Encerradas' },
    { key: 'todas', label: 'Todas' },
  ];

  // Busca atravessa os segmentos: quem digita um número/cliente quer achar a
  // proposta onde quer que ela esteja, sem precisar adivinhar o chip certo.
  const effectiveSegment: Segment = searchTerm.trim() ? 'todas' : segment;

  const filteredProposals = proposals.filter(proposal => {
    const matchesSegment = effectiveSegment === 'todas' || lifecycleOf(proposal) === effectiveSegment;
    const matchesSearch = !searchTerm ||
      proposal.proposal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.clients?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || statusFilter === 'all' || proposal.status === statusFilter;
    const matchesCategory = !eventCategoryFilter || eventCategoryFilter === 'all' || proposal.event_category === eventCategoryFilter;
    const matchesKind = !kindFilter || kindFilter === 'all'
      || (kindFilter === 'umbrella' ? !!proposal.is_umbrella : !proposal.is_umbrella);

    return matchesSegment && matchesSearch && matchesStatus && matchesCategory && matchesKind;
  });

  // Ativas: ordena pela próxima entrega (a mais urgente primeiro; sem data no
  // fim). Demais segmentos mantêm a ordem do fetch (mais recente primeiro).
  const displayProposals = effectiveSegment === 'ativa'
    ? [...filteredProposals].sort((a, b) => {
        if (a.next_delivery && b.next_delivery) return a.next_delivery.localeCompare(b.next_delivery);
        if (a.next_delivery) return -1;
        if (b.next_delivery) return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
      })
    : filteredProposals;

  // KPIs comerciais — sempre sobre TODAS as propostas (retrato do portfólio),
  // senão o segmento padrão "Em negociação" mostraria Aprovadas/Valor zerados.
  const kpiTotal = proposals.length;
  const kpiAprovadas = proposals.filter(p => p.status === 'Aprovada').length;
  const kpiEmAberto = proposals.filter(p => ['Rascunho', 'Enviada', 'Aprovada pelo Cliente'].includes(p.status)).length;
  const kpiValorAprovado = proposals
    .filter(p => p.status === 'Aprovada')
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  const proposalKindLabel = (kind: string) => (kind === 'event_table' ? 'Evento' : 'Produto');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Carregando propostas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Propostas Comerciais</CardTitle>
            <Button onClick={onNewProposal}>
              <Plus size={16} className="mr-2" />
              Nova Proposta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Fase de vida: negociação × ativas × encerradas */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {segmentDefs.map(s => (
                <Button
                  key={s.key}
                  size="sm"
                  variant={segment === s.key ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSegment(s.key)}
                >
                  {s.label}
                  <span className="ml-1.5 opacity-75">
                    ({s.key === 'todas' ? proposals.length : segmentCounts[s.key]})
                  </span>
                </Button>
              ))}
            </div>
            {segment === 'ativa' && (
              <p className="text-xs text-muted-foreground mt-2">
                Aprovadas com entrega pendente e contratos recorrentes — ordenado pela próxima entrega, a mais urgente primeiro.
              </p>
            )}
            {segment === 'encerrada' && (
              <p className="text-xs text-muted-foreground mt-2">
                Entregues, rejeitadas e canceladas — histórico consultável, fora do caminho do dia a dia.
              </p>
            )}
          </div>

          {/* KPIs comerciais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{kpiTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">Propostas</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{kpiAprovadas}</p>
                <p className="text-xs text-muted-foreground mt-1">Aprovadas</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <Send className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{kpiEmAberto}</p>
                <p className="text-xs text-muted-foreground mt-1">Em aberto</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold leading-none">{formatCurrency(kpiValorAprovado)}</p>
                <p className="text-xs text-muted-foreground mt-1">Valor aprovado</p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventCategoryFilter} onValueChange={setEventCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {eventCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="single">Avulsas</SelectItem>
                <SelectItem value="umbrella">Recorrentes (guarda-chuva)</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={refetchProposals}>
              Atualizar
            </Button>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead className="whitespace-nowrap">{effectiveSegment === 'ativa' ? 'Próxima entrega' : 'Data'}</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayProposals.length > 0 ? (
                  displayProposals.map((proposal) => (
                    <TableRow
                      key={proposal.id}
                      className="cursor-pointer"
                      onClick={() => {
                        // Clique na linha abre a visualização (guarda-chuva aprovada
                        // vai direto pro painel de saldo/execuções).
                        if (proposal.is_umbrella && proposal.status === 'Aprovada' && onViewUmbrella) {
                          onViewUmbrella(proposal.id);
                        } else {
                          onViewProposal(proposal.id);
                        }
                      }}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {proposal.proposal_number}
                        {proposal.revision > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">· Rev. {proposal.revision}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="secondary">{proposalKindLabel(proposal.proposal_kind)}</Badge>
                          {proposal.is_umbrella && (
                            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary whitespace-nowrap">
                              Recorrente
                            </Badge>
                          )}
                          {/* Pendências do portal esperando a equipe — clicável direto pro lugar certo */}
                          {(proposal.pending_execution_requests ?? 0) > 0 && onViewUmbrella && (
                            <Badge
                              className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-300 whitespace-nowrap cursor-pointer"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); onViewUmbrella(proposal.id); }}
                            >
                              {proposal.pending_execution_requests} fornecimento{(proposal.pending_execution_requests ?? 0) > 1 ? 's' : ''} a confirmar
                            </Badge>
                          )}
                          {(proposal.pending_change_requests ?? 0) > 0 && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 whitespace-nowrap">
                              Alteração em análise
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{proposal.clients?.name || '—'}</div>
                        {proposal.requester_name && (
                          <div className="text-xs text-muted-foreground">Solicitante: {proposal.requester_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {proposal.event_category
                          ? <Badge variant="outline">{proposal.event_category}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {effectiveSegment === 'ativa' ? (
                          proposal.next_delivery ? (
                            <span className="font-medium">{formatLocalDate(proposal.next_delivery)}</span>
                          ) : proposal.is_umbrella ? (
                            <span className="text-muted-foreground text-sm">nada agendado</span>
                          ) : proposal.all_events_cancelled ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 whitespace-nowrap">
                              evento cancelado — decidir
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 whitespace-nowrap">
                              sem data definida
                            </Badge>
                          )
                        ) : (
                          proposal.event_date ? formatLocalDate(proposal.event_date) : '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">{proposal.number_of_people}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="font-medium">{formatCurrency(proposal.total_amount)}</div>
                        {proposal.number_of_people > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(proposal.total_amount / proposal.number_of_people)}/pessoa
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(proposal)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {proposal.is_umbrella && proposal.status === 'Aprovada' && onViewUmbrella ? (
                              // Guarda-chuva já aprovada: nunca abre o editor completo (que apaga e
                              // recria composições/eventos) — só o painel de saldo/execuções.
                              <DropdownMenuItem onClick={() => onViewUmbrella(proposal.id)}>
                                <Wallet size={14} className="mr-2" /> Ver saldo e execuções
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => onViewProposal(proposal.id)}>
                                  <Eye size={14} className="mr-2" /> Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEditProposal(proposal.id)}>
                                  <Edit size={14} className="mr-2" /> Editar
                                </DropdownMenuItem>
                              </>
                            )}
                            {onPdfProposal && (
                              <DropdownMenuItem onClick={() => onPdfProposal(proposal.id)}>
                                <FileDown size={14} className="mr-2" /> Gerar PDF
                              </DropdownMenuItem>
                            )}
                            {['Rascunho', 'Enviada', 'Aprovada pelo Cliente'].includes(proposal.status) && (
                              <DropdownMenuItem onClick={() => handleApprove(proposal.id)}>
                                <CheckCircle2 size={14} className="mr-2" />
                                {proposal.status === 'Aprovada pelo Cliente' ? 'Revisar e aprovar' : 'Aprovar proposta'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicate(proposal.id)}>
                              <Copy size={14} className="mr-2" /> Duplicar
                            </DropdownMenuItem>
                            {!(proposal.is_umbrella && proposal.status === 'Aprovada')
                              && !['Cancelada', 'Rejeitada'].includes(proposal.status)
                              && (proposal.status !== 'Aprovada' || !proposal.has_active_events) && (
                              // Nunca excluir, só cancelar. Aprovada com evento ativo (futuro
                              // ou entregue) não se cancela por aqui: o cancelamento não
                              // cascateia pra Agenda/ordens — cancele o evento na Agenda
                              // primeiro (aí a opção aparece). Guarda-chuva aprovada idem.
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCancelProposal(proposal.id)}
                                  className="text-destructive focus:text-destructive">
                                  <Ban size={14} className="mr-2" /> Cancelar proposta
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {searchTerm || statusFilter || eventCategoryFilter || kindFilter
                        ? 'Nenhuma proposta encontrada com os filtros aplicados (confira também o segmento selecionado acima).'
                        : segment !== 'todas'
                          ? 'Nenhuma proposta neste segmento.'
                          : 'Nenhuma proposta cadastrada ainda.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
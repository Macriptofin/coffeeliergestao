import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Copy, Trash2, CheckCircle2, FileDown, Send, MoreHorizontal, FileText, CheckSquare, Wallet } from 'lucide-react';
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
  created_at: string;
  auto_generated_event_table_id?: string;
  auto_generated_bom_order_id?: string;
  generated_order_id?: string;
  clients?: {
    name: string;
  };
  portal_created_by?: string | null;
  requester_name?: string | null; // nome do solicitante (usuário do portal), se houver
}

interface Props {
  onNewProposal: () => void;
  onEditProposal: (id: string) => void;
  onViewProposal: (id: string) => void;
  onPdfProposal?: (id: string) => void;
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
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      clients (
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = ((data as any) || []) as Proposal[];
  // Enriquecer com o nome do solicitante (usuário do portal) quando houver.
  const ids = Array.from(new Set(rows.map(r => r.portal_created_by).filter(Boolean))) as string[];
  if (ids.length) {
    const { data: profs } = await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', ids);
    const pm = new Map((profs || []).map((p: any) => [p.user_id, p.full_name || p.email]));
    rows.forEach(r => { r.requester_name = r.portal_created_by ? (pm.get(r.portal_created_by) || 'Usuário do portal') : null; });
  }
  return rows;
}

export default function ProposalsList({ onNewProposal, onEditProposal, onViewProposal, onPdfProposal }: Props) {
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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta?')) return;

    try {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Proposta excluída com sucesso!');
      refetchProposals();
    } catch (error) {
      console.error('Erro ao excluir proposta:', error);
      toast.error('Erro ao excluir proposta');
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

  const handleSendForApproval = async (proposalId: string) => {
    try {
      // Criar token de aprovação
      const { data, error } = await supabase
        .from('proposal_approval_tokens')
        .insert({ proposal_id: proposalId })
        .select('token')
        .single();

      if (error) throw error;

      // Marcar proposta como enviada
      await supabase.from('proposals').update({ status: 'Enviada' }).eq('id', proposalId);

      // Copiar link para o clipboard
      const url = `${window.location.origin}/aprovar/${data.token}`;
      await navigator.clipboard.writeText(url);

      toast.success('Link copiado! Cole no e-mail ou WhatsApp para enviar ao cliente.', {
        duration: 6000,
        description: url,
      });

      refetchProposals();
    } catch (e: any) {
      toast.error('Erro ao gerar link: ' + e.message);
    }
  };

  const handleApprove = async (proposalId: string) => {
    try {
      await supabase.from('proposals').update({ status: 'Aprovada' }).eq('id', proposalId);
      const { error: evtErr }  = await (supabase.rpc as any)('create_event_from_proposal',      { p_proposal_id: proposalId });
      const { error: prodErr } = await supabase.rpc('generate_production_from_proposal', { p_proposal_id: proposalId });
      if (evtErr)  console.warn('create_event_from_proposal:',      evtErr.message);
      if (prodErr) console.warn('generate_production_from_proposal:', prodErr.message);
      toast.success('Proposta aprovada! Evento e OP criados automaticamente.');
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

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return (
      <Badge variant={statusOption?.variant as any || 'secondary'} className={statusOption?.className || ''}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = !searchTerm || 
      proposal.proposal_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.clients?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || proposal.status === statusFilter;
    const matchesCategory = !eventCategoryFilter || eventCategoryFilter === 'all' || proposal.event_category === eventCategoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // KPIs comerciais (refletem o filtro atual)
  const kpiTotal = filteredProposals.length;
  const kpiAprovadas = filteredProposals.filter(p => p.status === 'Aprovada').length;
  const kpiEmAberto = filteredProposals.filter(p => ['Rascunho', 'Enviada', 'Aprovada pelo Cliente'].includes(p.status)).length;
  const kpiValorAprovado = filteredProposals
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.length > 0 ? (
                  filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {proposal.proposal_number}
                        {proposal.revision > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">· Rev. {proposal.revision}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{proposalKindLabel(proposal.proposal_kind)}</Badge>
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
                        {proposal.event_date ? formatLocalDate(proposal.event_date) : '—'}
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
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => onViewProposal(proposal.id)}>
                              <Eye size={14} className="mr-2" /> Visualizar / Compor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditProposal(proposal.id)}>
                              <Edit size={14} className="mr-2" /> Editar
                            </DropdownMenuItem>
                            {onPdfProposal && (
                              <DropdownMenuItem onClick={() => onPdfProposal(proposal.id)}>
                                <FileDown size={14} className="mr-2" /> Gerar PDF
                              </DropdownMenuItem>
                            )}
                            {['Rascunho', 'Enviada'].includes(proposal.status) && (
                              <DropdownMenuItem onClick={() => handleSendForApproval(proposal.id)}>
                                <Send size={14} className="mr-2" /> Link de aprovação
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(proposal.id)}
                              className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {searchTerm || statusFilter || eventCategoryFilter
                        ? 'Nenhuma proposta encontrada com os filtros aplicados.'
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
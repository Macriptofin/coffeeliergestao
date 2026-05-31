import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Copy, Trash2, Factory, ShoppingCart, CheckCircle2, FileDown, Send, Link } from 'lucide-react';
import { toast } from 'sonner';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  status: string;
  created_at: string;
  auto_generated_event_table_id?: string;
  auto_generated_bom_order_id?: string;
  generated_order_id?: string;
  clients?: {
    name: string;
  };
}

interface Props {
  onNewProposal: () => void;
  onEditProposal: (id: string) => void;
  onViewProposal: (id: string) => void;
  onPdfProposal?: (id: string) => void;
}

const statusOptions = [
  { value: 'rascunho', label: 'Rascunho', variant: 'secondary' },
  { value: 'enviada',  label: 'Enviada',  variant: 'default' },
  { value: 'aprovada', label: 'Aprovada', variant: 'success' },
  { value: 'recusada', label: 'Recusada', variant: 'destructive' },
  { value: 'cancelada',label: 'Cancelada',variant: 'outline' },
  // compatibilidade com valores capitalizados legado
  { value: 'Rascunho', label: 'Rascunho', variant: 'secondary' },
  { value: 'Enviada',  label: 'Enviada',  variant: 'default' },
  { value: 'Aprovada', label: 'Aprovada', variant: 'success' },
];

export default function ProposalsList({ onNewProposal, onEditProposal, onViewProposal, onPdfProposal }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      setLoading(true);
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
      setProposals(data as any || []);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
      toast.error('Erro ao carregar propostas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta?')) return;

    try {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Proposta excluída com sucesso!');
      loadProposals();
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
      loadProposals();
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
      loadProposals();
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
      await supabase.from('proposals').update({ status: 'enviada' }).eq('id', proposalId);

      // Copiar link para o clipboard
      const url = `${window.location.origin}/aprovar/${data.token}`;
      await navigator.clipboard.writeText(url);

      toast.success('Link copiado! Cole no e-mail ou WhatsApp para enviar ao cliente.', {
        duration: 6000,
        description: url,
      });

      loadProposals();
    } catch (e: any) {
      toast.error('Erro ao gerar link: ' + e.message);
    }
  };

  const handleApprove = async (proposalId: string) => {
    try {
      await supabase.from('proposals').update({ status: 'aprovada' }).eq('id', proposalId);
      const { error: evtErr }  = await supabase.rpc('create_event_from_proposal',      { p_proposal_id: proposalId });
      const { error: prodErr } = await supabase.rpc('generate_production_from_proposal', { p_proposal_id: proposalId });
      if (evtErr)  console.warn('create_event_from_proposal:',      evtErr.message);
      if (prodErr) console.warn('generate_production_from_proposal:', prodErr.message);
      toast.success('Proposta aprovada! Evento e OP criados automaticamente.');
      loadProposals();
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
          status:                  'rascunho',
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
      loadProposals();
    } catch (error) {
      console.error('Erro ao duplicar proposta:', error);
      toast.error('Erro ao duplicar proposta');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return (
      <Badge variant={statusOption?.variant as any || 'secondary'}>
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

            <Button variant="outline" onClick={loadProposals}>
              Atualizar
            </Button>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px] whitespace-nowrap">Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data Evento</TableHead>
                  <TableHead>Pessoas</TableHead>
                  <TableHead>Peso Total</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.length > 0 ? (
                  filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {proposal.proposal_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {proposal.proposal_kind === 'event_table' ? 'Evento/Mesa' : 'SKU'}
                        </Badge>
                      </TableCell>
                      <TableCell>{proposal.clients?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{proposal.event_category}</Badge>
                      </TableCell>
                      <TableCell>
                        {proposal.event_date 
                          ? new Date(proposal.event_date).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{proposal.number_of_people}</TableCell>
                      <TableCell>{proposal.total_weight}g</TableCell>
                      <TableCell>R$ {proposal.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => onViewProposal(proposal.id)} title="Visualizar / Compor">
                            <Eye size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => onEditProposal(proposal.id)} title="Editar">
                            <Edit size={13} />
                          </Button>
                          {onPdfProposal && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-700 hover:text-green-900"
                              onClick={() => onPdfProposal(proposal.id)} title="Gerar PDF da proposta">
                              <FileDown size={13} />
                            </Button>
                          )}
                          {/* Enviar para aprovação do cliente */}
                          {!['aprovada', 'Aprovada', 'cancelada'].includes(proposal.status) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-800"
                              onClick={() => handleSendForApproval(proposal.id)}
                              title="Gerar link de aprovação para o cliente">
                              <Send size={13} />
                            </Button>
                          )}
                          {/* Botão Aprovar */}
                          {!['aprovada', 'Aprovada', 'cancelada'].includes(proposal.status) && (
                            <Button
                              size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(proposal.id)}
                              title="Aprovar proposta (cria evento + OP automaticamente)"
                            >
                              <CheckCircle2 size={13} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => handleDuplicate(proposal.id)} title="Duplicar">
                            <Copy size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(proposal.id)} title="Excluir">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
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
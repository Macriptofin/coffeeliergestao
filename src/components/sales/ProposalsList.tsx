import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Edit, Copy, Trash2 } from 'lucide-react';
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
  number_of_people: number;
  total_amount: number;
  total_weight: number;
  status: string;
  created_at: string;
  clients?: {
    name: string;
  };
}

interface Props {
  onNewProposal: () => void;
  onEditProposal: (id: string) => void;
  onViewProposal: (id: string) => void;
}

const statusOptions = [
  { value: 'Rascunho', label: 'Rascunho', variant: 'secondary' },
  { value: 'Enviada', label: 'Enviada', variant: 'default' },
  { value: 'Aprovada', label: 'Aprovada', variant: 'success' },
  { value: 'Rejeitada', label: 'Rejeitada', variant: 'destructive' },
  { value: 'Cancelada', label: 'Cancelada', variant: 'outline' }
];

export default function ProposalsList({ onNewProposal, onEditProposal, onViewProposal }: Props) {
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
      setProposals(data || []);
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

  const handleDuplicate = async (originalId: string) => {
    try {
      // Buscar proposta original com itens
      const { data: originalProposal, error: fetchError } = await supabase
        .from('proposals')
        .select(`
          *,
          proposal_items (*)
        `)
        .eq('id', originalId)
        .single();

      if (fetchError) throw fetchError;

      // Criar nova proposta
      const newProposalData = {
        client_id: originalProposal.client_id,
        event_category: originalProposal.event_category,
        event_date: null, // Limpar data do evento
        number_of_people: originalProposal.number_of_people,
        target_weight_per_person: originalProposal.target_weight_per_person,
        total_target_weight: originalProposal.total_target_weight,
        total_weight: originalProposal.total_weight,
        total_amount: originalProposal.total_amount,
        notes: originalProposal.notes,
        status: 'Rascunho'
      };

      const { data: newProposal, error: createError } = await supabase
        .from('proposals')
        .insert(newProposalData)
        .select()
        .single();

      if (createError) throw createError;

      // Duplicar itens
      if (originalProposal.proposal_items && originalProposal.proposal_items.length > 0) {
        const itemsToInsert = originalProposal.proposal_items.map((item: any) => ({
          proposal_id: newProposal.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_weight: item.unit_weight,
          unit_price: item.unit_price,
          total_weight: item.total_weight,
          total_price: item.total_price
        }));

        const { error: itemsError } = await supabase
          .from('proposal_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
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
    
    const matchesStatus = !statusFilter || proposal.status === statusFilter;
    const matchesCategory = !eventCategoryFilter || proposal.event_category === eventCategoryFilter;

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
                <SelectItem value="">Todos os status</SelectItem>
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
                <SelectItem value="">Todas as categorias</SelectItem>
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
                  <TableHead>Número</TableHead>
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
                      <TableCell className="font-medium">
                        {proposal.proposal_number}
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
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewProposal(proposal.id)}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditProposal(proposal.id)}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicate(proposal.id)}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(proposal.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
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
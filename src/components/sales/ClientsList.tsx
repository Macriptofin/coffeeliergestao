import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, User, Eye, Building2, UserCircle } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Client {
  id: string;
  name: string;
  fantasy_name?: string;
  client_type?: 'PF' | 'PJ';
  client_code?: string;
  cnpj_cpf?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  _departments_count?: number;
  _contacts_count?: number;
  _units_count?: number;
}

interface Props {
  onNewClient: () => void;
  onEditClient: (id: string) => void;
  onViewClient?: (id: string) => void;
}

const statusOptions = [
  { value: 'Ativo', label: 'Ativo', variant: 'default' },
  { value: 'Inativo', label: 'Inativo', variant: 'secondary' },
  { value: 'Suspenso', label: 'Suspenso', variant: 'destructive' }
];

export default function ClientsList({ onNewClient, onEditClient, onViewClient }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Load clients with counts
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;

      // Load counts for departments, contacts, and units
      const clientIds = clientsData?.map(c => c.id) || [];
      
      if (clientIds.length > 0) {
        const [deptsRes, contactsRes, unitsRes] = await Promise.all([
          supabase.from('client_departments').select('client_id'),
          supabase.from('client_contacts').select('client_id'),
          supabase.from('client_units').select('client_id')
        ]);

        const deptCounts = (deptsRes.data || []).reduce((acc, d) => {
          acc[d.client_id] = (acc[d.client_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const contactCounts = (contactsRes.data || []).reduce((acc, c) => {
          acc[c.client_id] = (acc[c.client_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const unitCounts = (unitsRes.data || []).reduce((acc, u) => {
          acc[u.client_id] = (acc[u.client_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const enrichedClients = clientsData?.map(client => ({
          ...client,
          client_type: client.client_type as 'PF' | 'PJ' | undefined,
          _departments_count: deptCounts[client.id] || 0,
          _contacts_count: contactCounts[client.id] || 0,
          _units_count: unitCounts[client.id] || 0
        })) || [];

        setClients(enrichedClients);
      } else {
        setClients([]);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Cliente "${name}" excluído com sucesso!`);
      loadClients();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
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

  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchTerm || 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.fantasy_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.client_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj_cpf?.includes(searchTerm) ||
      client.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Helper to get display name (fantasy_name if available, otherwise name)
  const getDisplayName = (client: Client) => client.fantasy_name || client.name;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Carregando clientes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Clientes</CardTitle>
            <Button onClick={onNewClient}>
              <Plus size={16} className="mr-2" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail, CPF/CNPJ ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
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

            <Button variant="outline" onClick={loadClients}>
              Atualizar
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <User className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {clients.filter(c => c.status === 'Ativo').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Clientes Ativos</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {clients.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Clientes</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <User className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {clients.filter(c => c.status === 'Inativo').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Clientes Inativos</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabela */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] whitespace-nowrap">Código</TableHead>
                  <TableHead className="min-w-[250px]">Cliente</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                  <TableHead className="w-[120px]">Estrutura</TableHead>
                  <TableHead className="w-[130px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
                          {client.client_code || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium whitespace-nowrap flex items-center gap-2">
                            {getDisplayName(client)}
                            {client.client_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {client.client_type}
                              </Badge>
                            )}
                          </div>
                          {client.fantasy_name && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={client.name}>
                              {client.name}
                            </div>
                          )}
                          {client.cnpj_cpf && (
                            <div className="text-xs text-muted-foreground">
                              {client.cnpj_cpf}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.city || client.state ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin size={12} className="text-muted-foreground" />
                            <span className="truncate max-w-[100px]">
                              {[client.city, client.state].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded">
                                  <Building2 size={10} />
                                  {client._departments_count || 0}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Departamentos</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded">
                                  <UserCircle size={10} />
                                  {client._contacts_count || 0}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Contatos</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded">
                                  <MapPin size={10} />
                                  {client._units_count || 0}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Unidades</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {onViewClient && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewClient(client.id)}
                                  >
                                    <Eye size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalhes</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onEditClient(client.id)}
                                >
                                  <Edit size={14} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar dados</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cliente "{client.name}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(client.id, client.name)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== 'all'
                        ? 'Nenhum cliente encontrado com os filtros aplicados.'
                        : 'Nenhum cliente cadastrado ainda.'}
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
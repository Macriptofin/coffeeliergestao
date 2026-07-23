import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useClientAssignments } from '@/hooks/useClientAssignments';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Trash2 } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
}

const EMPTY_CLIENTS: Client[] = [];
const EMPTY_MANAGERS: User[] = [];

async function fetchClientsAndManagers(): Promise<{ clients: Client[]; managers: User[] }> {
  const [{ data: clientsData }, { data: managerRoles }] = await Promise.all([
    supabase.from('clients').select('id, name').order('name'),
    supabase
      .from('user_roles')
      .select('user_id, user_profiles!user_roles_user_id_fkey(email)')
      .eq('role', 'manager'),
  ]);

  return {
    clients: clientsData || [],
    managers: (managerRoles || []).map((r: any) => ({
      id: r.user_id,
      email: r.user_profiles?.email || 'Unknown',
    })),
  };
}

export function ClientAssignmentsManager() {
  const { loading, assignments, assignClient, unassignClient } =
    useClientAssignments();
  const { data } = useQuery({
    queryKey: ['clients-and-managers'],
    queryFn: fetchClientsAndManagers,
  });
  const clients = data?.clients ?? EMPTY_CLIENTS;
  const managers = data?.managers ?? EMPTY_MANAGERS;
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [notes, setNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAssign = async () => {
    if (!selectedClient || !selectedManager) return;

    await assignClient(selectedClient, selectedManager, notes);
    setSelectedClient('');
    setSelectedManager('');
    setNotes('');
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Atribuições de Clientes</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Atribuir Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir Cliente a Gerente</DialogTitle>
              <DialogDescription>
                Selecione um cliente e um gerente para criar a atribuição.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Gerente</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre esta atribuição..."
                />
              </div>

              <Button onClick={handleAssign} className="w-full" disabled={loading}>
                Atribuir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading && <p className="text-muted-foreground">Carregando...</p>}

        {!loading && assignments.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            Nenhuma atribuição de cliente encontrada.
          </Card>
        )}

        {assignments.map((assignment) => (
          <Card key={assignment.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{assignment.clients?.name}</h4>
                  <Badge variant="outline">
                    {assignment.user_email}
                  </Badge>
                </div>
                {assignment.notes && (
                  <p className="text-sm text-muted-foreground">
                    {assignment.notes}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Atribuído em{' '}
                  {new Date(assignment.assigned_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unassignClient(assignment.id)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, Building, DoorOpen, UserCircle, FileText, Edit } from 'lucide-react';
import { toast } from 'sonner';
import ClientDepartments from './ClientDepartments';
import ClientUnits from './ClientUnits';
import ClientRooms from './ClientRooms';
import ClientContacts from './ClientContacts';

interface Client {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Stats {
  departments: number;
  units: number;
  rooms: number;
  contacts: number;
}

interface Props {
  clientId: string;
  onBack: () => void;
  onEdit: () => void;
}

export default function ClientDetails({ clientId, onBack, onEdit }: Props) {
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Stats>({ departments: 0, units: 0, rooms: 0, contacts: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('departments');

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      const [clientRes, deptRes, unitsRes, roomsRes, contactsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('client_departments').select('id', { count: 'exact' }).eq('client_id', clientId),
        supabase.from('client_units').select('id', { count: 'exact' }).eq('client_id', clientId),
        supabase.from('client_rooms').select('id', { count: 'exact' }).eq('client_id', clientId),
        supabase.from('client_contacts').select('id', { count: 'exact' }).eq('client_id', clientId)
      ]);

      if (clientRes.error) throw clientRes.error;

      setClient(clientRes.data);
      setStats({
        departments: deptRes.count || 0,
        units: unitsRes.count || 0,
        rooms: roomsRes.count || 0,
        contacts: contactsRes.count || 0
      });
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button variant="outline" onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{client.name}</h2>
            {client.cnpj_cpf && (
              <p className="text-sm text-muted-foreground">{client.cnpj_cpf}</p>
            )}
          </div>
          <Badge variant={client.status === 'Ativo' ? 'default' : 'secondary'}>
            {client.status}
          </Badge>
        </div>
        <Button onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Editar Dados
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveTab('departments')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.departments}</div>
              <div className="text-xs text-muted-foreground">Departamentos</div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveTab('units')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.units}</div>
              <div className="text-xs text-muted-foreground">Unidades</div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveTab('rooms')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DoorOpen className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.rooms}</div>
              <div className="text-xs text-muted-foreground">Salas</div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveTab('contacts')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.contacts}</div>
              <div className="text-xs text-muted-foreground">Contatos</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="departments" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Departamentos</span>
              </TabsTrigger>
              <TabsTrigger value="units" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Unidades</span>
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Salas</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Contatos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="departments">
              <ClientDepartments clientId={clientId} />
            </TabsContent>

            <TabsContent value="units">
              <ClientUnits clientId={clientId} />
            </TabsContent>

            <TabsContent value="rooms">
              <ClientRooms clientId={clientId} />
            </TabsContent>

            <TabsContent value="contacts">
              <ClientContacts clientId={clientId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

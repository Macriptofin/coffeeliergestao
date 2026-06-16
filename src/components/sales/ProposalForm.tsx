import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { todayLocalISO } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  fantasy_name?: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  unit_id: string;
}

interface Contact {
  id: string;
  name: string;
  department_id?: string | null;
}

interface ProposalFormData {
  client_id: string;
  department_id?: string;
  unit_id?: string;
  room_id?: string;
  contact_id?: string;
  event_category: string;
  event_date: string;
  proposal_date: string;
  number_of_people: number;
  target_weight_per_person: number;
  proposal_kind: 'event_table' | 'bom_sku';
  notes?: string;
}

interface Props {
  onSuccess: (proposalId?: string) => void;
  onCancel: () => void;
}

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

export default function ProposalForm({ onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Client structure state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProposalFormData>({
    defaultValues: {
      target_weight_per_person: 200,
      proposal_kind: 'event_table',
      proposal_date: todayLocalISO()
    }
  });

  const watchedValues = watch();
  const selectedClientId = watchedValues.client_id;
  const selectedDepartmentId = watchedValues.department_id;
  const selectedUnitId = watchedValues.unit_id;
  
  const totalTargetWeight = (watchedValues.number_of_people || 0) * (watchedValues.target_weight_per_person || 200);

  // Filtered rooms based on selected unit
  const filteredRooms = useMemo(() => {
    if (!selectedUnitId) return rooms;
    return rooms.filter(room => room.unit_id === selectedUnitId);
  }, [rooms, selectedUnitId]);

  // Filtered contacts based on selected department
  const filteredContacts = useMemo(() => {
    if (!selectedDepartmentId) return contacts;
    return contacts.filter(contact => 
      !contact.department_id || contact.department_id === selectedDepartmentId
    );
  }, [contacts, selectedDepartmentId]);

  useEffect(() => {
    loadClients();
  }, []);

  // Load client structure when client is selected
  useEffect(() => {
    if (selectedClientId) {
      loadClientStructure(selectedClientId);
    } else {
      // Reset structure when no client selected
      setDepartments([]);
      setUnits([]);
      setRooms([]);
      setContacts([]);
    }
  }, [selectedClientId]);

  // Reset dependent fields when parent selection changes
  useEffect(() => {
    if (selectedUnitId) {
      const currentRoomId = watchedValues.room_id;
      const roomStillValid = filteredRooms.some(r => r.id === currentRoomId);
      if (!roomStillValid && currentRoomId) {
        setValue('room_id', undefined);
      }
    }
  }, [selectedUnitId, filteredRooms, watchedValues.room_id, setValue]);

  useEffect(() => {
    if (selectedDepartmentId) {
      const currentContactId = watchedValues.contact_id;
      const contactStillValid = filteredContacts.some(c => c.id === currentContactId);
      if (!contactStillValid && currentContactId) {
        setValue('contact_id', undefined);
      }
    }
  }, [selectedDepartmentId, filteredContacts, watchedValues.contact_id, setValue]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, fantasy_name')
        .eq('status', 'Ativo')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadClientStructure = async (clientId: string) => {
    setLoadingStructure(true);
    try {
      // Load all client structure data in parallel
      const [deptResult, unitResult, roomResult, contactResult] = await Promise.all([
        supabase
          .from('client_departments')
          .select('id, name')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('client_units')
          .select('id, name')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('client_rooms')
          .select('id, name, unit_id')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('client_contacts')
          .select('id, name, department_id')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (deptResult.error) throw deptResult.error;
      if (unitResult.error) throw unitResult.error;
      if (roomResult.error) throw roomResult.error;
      if (contactResult.error) throw contactResult.error;

      setDepartments(deptResult.data || []);
      setUnits(unitResult.data || []);
      setRooms(roomResult.data || []);
      setContacts(contactResult.data || []);

      // Reset structure selections when client changes
      setValue('department_id', undefined);
      setValue('unit_id', undefined);
      setValue('room_id', undefined);
      setValue('contact_id', undefined);
    } catch (error) {
      console.error('Erro ao carregar estrutura do cliente:', error);
      toast.error('Erro ao carregar estrutura do cliente');
    } finally {
      setLoadingStructure(false);
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    try {
      setLoading(true);

      const proposalData = {
        client_id: data.client_id,
        department_id: data.department_id || null,
        unit_id: data.unit_id || null,
        room_id: data.room_id || null,
        contact_id: data.contact_id || null,
        event_category: data.event_category,
        event_date: data.event_date || null,
        proposal_date: data.proposal_date,
        proposal_kind: data.proposal_kind,
        number_of_people: data.number_of_people,
        target_weight_per_person: data.target_weight_per_person,
        total_weight: 0,
        total_amount: 0,
        notes: data.notes || null,
        status: 'Rascunho'
      };

      const { data: savedProposal, error } = await supabase
        .from('proposals')
        .insert(proposalData as any)
        .select()
        .single();

      if (error) throw error;

      toast.success('Proposta criada com sucesso!');
      onSuccess(savedProposal.id);
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      toast.error('Erro ao salvar proposta');
    } finally {
      setLoading(false);
    }
  };

  const getClientDisplayName = (client: Client) => {
    return client.fantasy_name || client.name;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Proposta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proposal_kind">Tipo de Proposta *</Label>
              <Select 
                defaultValue="event_table"
                onValueChange={(value) => setValue('proposal_kind', value as 'event_table' | 'bom_sku')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event_table">Evento/Mesa</SelectItem>
                  <SelectItem value="bom_sku">Produtos SKU</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="proposal_date">Data da Proposta *</Label>
              <Input
                type="date"
                autoComplete="off"
                {...register('proposal_date', { required: true })}
              />
              {errors.proposal_date && <span className="text-sm text-destructive">Campo obrigatório</span>}
            </div>

            <div>
              <Label htmlFor="client_id">Cliente *</Label>
              <Select onValueChange={(value) => setValue('client_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.filter(client => client.id && client.id.trim() !== '').map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {getClientDisplayName(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && <span className="text-sm text-destructive">Campo obrigatório</span>}
            </div>

            <div>
              <Label htmlFor="event_category">Categoria do Evento *</Label>
              <Select onValueChange={(value) => setValue('event_category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {eventCategories.filter(category => category && category.trim() !== '').map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.event_category && <span className="text-sm text-destructive">Campo obrigatório</span>}
            </div>
          </div>

          {/* Client Structure Fields - Only show if client is selected and has structure data */}
          {selectedClientId && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">
                Estrutura do Cliente {loadingStructure && '(Carregando...)'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="department_id">Departamento</Label>
                  <Select 
                    value={watchedValues.department_id || ''} 
                    onValueChange={(value) => setValue('department_id', value || undefined)}
                    disabled={loadingStructure || departments.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={departments.length === 0 ? 'Nenhum cadastrado' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="unit_id">Unidade</Label>
                  <Select 
                    value={watchedValues.unit_id || ''} 
                    onValueChange={(value) => setValue('unit_id', value || undefined)}
                    disabled={loadingStructure || units.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={units.length === 0 ? 'Nenhuma cadastrada' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="room_id">Sala</Label>
                  <Select 
                    value={watchedValues.room_id || ''} 
                    onValueChange={(value) => setValue('room_id', value || undefined)}
                    disabled={loadingStructure || filteredRooms.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filteredRooms.length === 0 ? 'Nenhuma cadastrada' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contact_id">Contato/Solicitante</Label>
                  <Select 
                    value={watchedValues.contact_id || ''} 
                    onValueChange={(value) => setValue('contact_id', value || undefined)}
                    disabled={loadingStructure || filteredContacts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filteredContacts.length === 0 ? 'Nenhum cadastrado' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredContacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event_date">Data do Evento</Label>
              <Input
                type="date"
                autoComplete="off"
                {...register('event_date')}
              />
            </div>

            <div>
              <Label htmlFor="number_of_people">Número de Pessoas *</Label>
              <Input
                type="number"
                min="1"
                autoComplete="off"
                {...register('number_of_people', { required: true, min: 1 })}
              />
              {errors.number_of_people && <span className="text-sm text-destructive">Campo obrigatório</span>}
            </div>

            <div>
              <Label htmlFor="target_weight_per_person">Peso por Pessoa (g) *</Label>
              <Input
                type="number"
                min="50"
                autoComplete="off"
                {...register('target_weight_per_person', { required: true, min: 50 })}
              />
              {errors.target_weight_per_person && <span className="text-sm text-destructive">Mínimo 50g</span>}
            </div>

            <div>
              <Label>Peso Total Alvo</Label>
              <Input
                value={`${totalTargetWeight}g`}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              {...register('notes')}
              rows={3}
              placeholder="Observações sobre o evento..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Proposta'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

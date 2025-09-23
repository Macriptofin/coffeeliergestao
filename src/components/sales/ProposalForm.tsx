import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  category: any;
  unit_weight: number;
  selling_price: number;
  code: string;
}

interface ProposalItem {
  product_id: string;
  product?: Product;
  quantity: number;
  unit_weight: number;
  unit_price: number;
  total_weight: number;
  total_price: number;
}

interface ProposalFormData {
  client_id: string;
  event_category: string;
  event_date: string;
  number_of_people: number;
  target_weight_per_person: number;
  notes?: string;
}

interface Props {
  proposalId?: string;
  onSuccess: () => void;
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

export default function ProposalForm({ proposalId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<ProposalItem[]>([]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ProposalFormData>({
    defaultValues: {
      target_weight_per_person: 200
    }
  });

  const watchedValues = watch();
  const totalTargetWeight = (watchedValues.number_of_people || 0) * (watchedValues.target_weight_per_person || 200);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        supabase.from('clients').select('id, name').eq('status', 'Ativo').order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name')
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (productsRes.error) throw productsRes.error;

      setClients(clientsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados iniciais');
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    try {
      setLoading(true);
      const totalWeight = items.reduce((sum, item) => sum + item.total_weight, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

      const proposalData = {
        client_id: data.client_id,
        event_category: data.event_category as any,
        event_date: data.event_date || null,
        number_of_people: data.number_of_people,
        target_weight_per_person: data.target_weight_per_person,
        total_target_weight: totalTargetWeight,
        total_weight: totalWeight,
        total_amount: totalAmount,
        notes: data.notes,
        status: 'Rascunho'
      };

      const { data: result, error } = await supabase
        .from('proposals')
        .insert(proposalData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Proposta criada com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      toast.error('Erro ao salvar proposta');
    } finally {
      setLoading(false);
    }
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
              <Label htmlFor="client_id">Cliente *</Label>
              <Select onValueChange={(value) => setValue('client_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="event_category">Categoria do Evento *</Label>
              <Select onValueChange={(value) => setValue('event_category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {eventCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="number_of_people">Número de Pessoas *</Label>
              <Input
                type="number"
                min="1"
                {...register('number_of_people', { required: true, min: 1 })}
              />
            </div>

            <div>
              <Label htmlFor="target_weight_per_person">Peso por Pessoa (g) *</Label>
              <Input
                type="number"
                min="50"
                {...register('target_weight_per_person', { required: true, min: 50 })}
              />
            </div>
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
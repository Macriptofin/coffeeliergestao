import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ClientFormData {
  name: string;
  client_type: 'PF' | 'PJ';
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
}

interface Props {
  clientId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function ClientForm({ clientId, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      status: 'Ativo',
      client_type: 'PJ'
    }
  });

  useEffect(() => {
    if (clientId) {
      loadClient(clientId);
    }
  }, [clientId]);

  const loadClient = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Preencher formulário
      Object.keys(data).forEach(key => {
        setValue(key as keyof ClientFormData, data[key]);
      });
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error('Erro ao carregar dados do cliente');
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    try {
      setLoading(true);

      const clientData = {
        name: data.name,
        client_type: data.client_type,
        cnpj_cpf: data.cnpj_cpf || null,
        email: data.email || null,
        phone: data.phone || null,
        contact_person: data.contact_person || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        status: data.status,
        notes: data.notes || null
      };

      if (clientId) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', clientId);

        if (error) throw error;
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Criar novo cliente
        const { error } = await supabase
          .from('clients')
          .insert(clientData);

        if (error) throw error;
        toast.success('Cliente cadastrado com sucesso!');
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  const formatCnpjCpf = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 11) {
      // Formatar como CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // Formatar como CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const formatPhone = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 10) {
      // Telefone fixo: (00) 0000-0000
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      // Celular: (00) 00000-0000
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
  };

  const formatZipCode = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    // Formatar como CEP: 00000-000
    return numbers.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{clientId ? 'Editar Cliente' : 'Novo Cliente'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="client_type">Tipo de Cliente *</Label>
                <Select
                  value={watch('client_type')}
                  onValueChange={(value: 'PF' | 'PJ') => setValue('client_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                    <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-2">
                <Label htmlFor="name">{watch('client_type') === 'PJ' ? 'Razão Social *' : 'Nome Completo *'}</Label>
                <Input
                  {...register('name', { required: 'Nome é obrigatório' })}
                  placeholder={watch('client_type') === 'PJ' ? 'Razão social da empresa' : 'Nome completo'}
                />
                {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
              </div>

              <div>
                <Label htmlFor="cnpj_cpf">{watch('client_type') === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                <Input
                  {...register('cnpj_cpf')}
                  placeholder={watch('client_type') === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  onChange={(e) => {
                    const formatted = formatCnpjCpf(e.target.value);
                    setValue('cnpj_cpf', formatted);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  type="email"
                  {...register('email')}
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  {...register('phone')}
                  placeholder="(00) 00000-0000"
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setValue('phone', formatted);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="contact_person">Pessoa de Contato</Label>
                <Input
                  {...register('contact_person')}
                  placeholder="Nome da pessoa responsável"
                />
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Endereço</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  {...register('address')}
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div>
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  {...register('zip_code')}
                  placeholder="00000-000"
                  onChange={(e) => {
                    const formatted = formatZipCode(e.target.value);
                    setValue('zip_code', formatted);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  {...register('city')}
                  placeholder="Nome da cidade"
                />
              </div>

              <div>
                <Label htmlFor="state">Estado</Label>
                <Select
                  value={watch('state') || ''}
                  onValueChange={(value) => setValue('state', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilianStates.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              {...register('notes')}
              rows={4}
              placeholder="Informações adicionais sobre o cliente..."
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (clientId ? 'Atualizar' : 'Cadastrar')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeDistanceKmFromCep } from '@/lib/geo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ClientFormData {
  name: string;
  fantasy_name?: string;
  client_type: 'PF' | 'PJ';
  cnpj_cpf?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  address_complement?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  distance_km?: number;
  status: string;
  notes?: string;
  // CRM
  lifecycle_stage?: string;
  lead_source?: string;
  segment?: string;
  classification?: string;
  // Faturamento
  state_registration?: string;
  billing_email?: string;
  payment_terms?: string;
}

interface Props {
  clientId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  embedded?: boolean;
}

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function ClientForm({ clientId, onSuccess, onCancel, embedded = false }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Guarda CEP/distância carregados para detectar mudança de endereço (preserva ajuste manual)
  const originalGeo = useRef<{ zip?: string; distance?: number | null }>({});

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      status: 'Ativo',
      client_type: 'PJ'
    }
  });

  const { data: clientData, isError: clientError } = useQuery({
    queryKey: ['client-detail-form', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (!clientData) return;
    // Preencher formulário
    Object.keys(clientData).forEach(key => {
      setValue(key as keyof ClientFormData, clientData[key]);
    });
    // Guarda referência de endereço/distância para recálculo só quando o CEP mudar
    originalGeo.current = { zip: clientData.zip_code ?? '', distance: clientData.distance_km ?? null };
  }, [clientData, setValue]);

  useEffect(() => {
    if (clientError) toast.error('Erro ao carregar dados do cliente');
  }, [clientError]);

  const onSubmit = async (data: ClientFormData) => {
    try {
      setLoading(true);

      // Distância automática pelo CEP: recalcula quando o CEP foi informado e mudou
      // (ou ainda não há distância). Ajuste manual preservado se o CEP não mudou.
      const cep = (data.zip_code ?? '').replace(/\D/g, '');
      const origCep = (originalGeo.current.zip ?? '').replace(/\D/g, '');
      let distance_km: number | null = originalGeo.current.distance ?? null;
      if (cep.length === 8 && (cep !== origCep || distance_km == null)) {
        const d = await computeDistanceKmFromCep(cep);
        if (d != null) distance_km = d;
      }

      const clientData = {
        name: data.name,
        fantasy_name: data.fantasy_name || null,
        client_type: data.client_type,
        cnpj_cpf: data.cnpj_cpf || null,
        email: data.email || null,
        phone: data.phone || null,
        contact_person: data.contact_person || null,
        address: data.address || null,
        address_number: data.address_number || null,
        neighborhood: data.neighborhood || null,
        address_complement: data.address_complement || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        distance_km,
        status: data.status,
        notes: data.notes || null,
        // CRM
        lifecycle_stage: data.lifecycle_stage || null,
        lead_source: data.lead_source || null,
        segment: data.segment || null,
        classification: data.classification || null,
        // Faturamento
        state_registration: data.state_registration || null,
        billing_email: data.billing_email || null,
        payment_terms: data.payment_terms || null
      };

      if (clientId) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', clientId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['client-details', clientId] });
        queryClient.invalidateQueries({ queryKey: ['client-detail-form', clientId] });
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Criar novo cliente
        const { error } = await supabase
          .from('clients')
          .insert(clientData);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['clients'] });
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

  const formContent = (
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

              {watch('client_type') === 'PJ' && (
                <div className="lg:col-span-2">
                  <Label htmlFor="fantasy_name">Nome Fantasia</Label>
                  <Input
                    {...register('fantasy_name')}
                    placeholder="Nome fantasia para exibição em listas"
                  />
                  <span className="text-xs text-muted-foreground">
                    Nome curto para exibição em listas e relatórios
                  </span>
                </div>
              )}

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

          {/* Comercial / CRM */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Comercial / CRM</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="lifecycle_stage">Estágio</Label>
                <Select
                  value={watch('lifecycle_stage') || ''}
                  onValueChange={(value) => setValue('lifecycle_stage', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Recorrente">Recorrente</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="lead_source">Origem</Label>
                <Select
                  value={watch('lead_source') || ''}
                  onValueChange={(value) => setValue('lead_source', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="Evento">Evento</SelectItem>
                    <SelectItem value="Prospecção">Prospecção</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="segment">Segmento</Label>
                <Input
                  {...register('segment')}
                  placeholder="Ex: Corporativo, Educação..."
                />
              </div>

              <div>
                <Label htmlFor="classification">Classificação</Label>
                <Select
                  value={watch('classification') || ''}
                  onValueChange={(value) => setValue('classification', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Faturamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Faturamento</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watch('client_type') === 'PJ' && (
                <div>
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input
                    {...register('state_registration')}
                    placeholder="IE ou Isento"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="billing_email">E-mail de Faturamento</Label>
                <Input
                  type="email"
                  {...register('billing_email')}
                  placeholder="financeiro@cliente.com"
                />
              </div>

              <div>
                <Label htmlFor="payment_terms">Condições de Pagamento</Label>
                <Input
                  {...register('payment_terms')}
                  placeholder="Ex: 30 dias, à vista..."
                />
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
                  placeholder="Rua / Logradouro"
                />
              </div>

              <div>
                <Label htmlFor="address_number">Número</Label>
                <Input
                  {...register('address_number')}
                  placeholder="Nº"
                />
              </div>

              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  {...register('neighborhood')}
                  placeholder="Bairro"
                />
              </div>

              <div>
                <Label htmlFor="address_complement">Complemento</Label>
                <Input
                  {...register('address_complement')}
                  placeholder="Sala, andar, bloco..."
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

              <div>
                <Label htmlFor="distance_km">Distância da sede (km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={watch('distance_km') ?? ''}
                  onChange={(e) => setValue('distance_km', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  placeholder="Calculada pelo CEP"
                />
                <span className="text-xs text-muted-foreground">
                  Calculada automaticamente pelo CEP ao salvar. Usada no frete da proposta.
                </span>
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
            {!embedded && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (clientId ? 'Atualizar' : 'Cadastrar')}
            </Button>
          </div>
        </form>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{clientId ? 'Editar Cliente' : 'Novo Cliente'}</CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Building2, User, MapPin, DollarSign, Star } from "lucide-react";

export interface Supplier {
  id: string;
  code: string;
  status: 'Ativo' | 'Inativo';
  // Identificação
  companyName: string;
  tradeName?: string;
  supplierType?: string;
  cnpjCpf?: string;
  stateRegistration?: string;
  mainCategory?: string;
  // Contatos
  contactName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  // Localização
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  distanceKm?: number;
  // Condições comerciais
  paymentTerms: number;
  paymentMethodPreferred?: string;
  pixKey?: string;
  minimumOrderValue: number;
  leadTimeDays?: number;
  // Avaliação e notas
  rating?: number;
  notes?: string;
}

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSubmit: (supplier: Omit<Supplier, 'id' | 'code'>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const SUPPLIER_CATEGORIES = [
  'Alimentos & Ingredientes',
  'Bebidas & Bar',
  'Embalagens & Descartáveis',
  'Higiene & Limpeza',
  'Equipamentos & Utensílios',
  'Serviços de Transporte / Frete',
  'Serviços de Locação',
  'Serviços de Manutenção',
  'Insumos Operacionais',
];

const PAYMENT_METHODS = [
  'PIX',
  'Boleto',
  'Transferência Bancária',
  'Dinheiro',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Cheque',
];

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{label}</h3>
  </div>
);

export const SupplierForm = ({ supplier, onSubmit, onCancel, isSubmitting = false }: SupplierFormProps) => {
  const [formData, setFormData] = useState({
    status:                   (supplier?.status || 'Ativo') as 'Ativo' | 'Inativo',
    supplierType:             supplier?.supplierType || 'PJ',
    mainCategory:             supplier?.mainCategory || '',
    companyName:              supplier?.companyName || '',
    tradeName:                supplier?.tradeName || '',
    cnpjCpf:                  supplier?.cnpjCpf || '',
    stateRegistration:        supplier?.stateRegistration || '',
    contactName:              supplier?.contactName || '',
    phone:                    supplier?.phone || '',
    whatsapp:                 supplier?.whatsapp || '',
    email:                    supplier?.email || '',
    website:                  supplier?.website || '',
    zipCode:                  supplier?.zipCode || '',
    address:                  supplier?.address || '',
    city:                     supplier?.city || '',
    state:                    supplier?.state || '',
    distanceKm:               supplier?.distanceKm?.toString() || '',
    paymentTerms:             supplier?.paymentTerms || 30,
    paymentMethodPreferred:   supplier?.paymentMethodPreferred || 'PIX',
    pixKey:                   supplier?.pixKey || '',
    minimumOrderValue:        supplier?.minimumOrderValue || 0,
    leadTimeDays:             supplier?.leadTimeDays || 3,
    rating:                   supplier?.rating?.toString() || '',
    notes:                    supplier?.notes || '',
  });

  const set = (field: keyof typeof formData, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      alert('A razão social é obrigatória');
      return;
    }
    onSubmit({
      status:                   formData.status,
      supplierType:             formData.supplierType || undefined,
      mainCategory:             formData.mainCategory || undefined,
      companyName:              formData.companyName,
      tradeName:                formData.tradeName || undefined,
      cnpjCpf:                  formData.cnpjCpf || undefined,
      stateRegistration:        formData.stateRegistration || undefined,
      contactName:              formData.contactName || undefined,
      phone:                    formData.phone || undefined,
      whatsapp:                 formData.whatsapp || undefined,
      email:                    formData.email || undefined,
      website:                  formData.website || undefined,
      zipCode:                  formData.zipCode || undefined,
      address:                  formData.address || undefined,
      city:                     formData.city || undefined,
      state:                    formData.state || undefined,
      distanceKm:               formData.distanceKm ? parseFloat(formData.distanceKm) : undefined,
      paymentTerms:             Number(formData.paymentTerms),
      paymentMethodPreferred:   formData.paymentMethodPreferred || undefined,
      pixKey:                   formData.pixKey || undefined,
      minimumOrderValue:        Number(formData.minimumOrderValue),
      leadTimeDays:             Number(formData.leadTimeDays),
      rating:                   formData.rating ? parseInt(formData.rating) : undefined,
      notes:                    formData.notes || undefined,
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          {supplier ? 'Editar fornecedor' : 'Novo fornecedor'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {supplier ? 'Atualize os dados do fornecedor' : 'Preencha os dados do novo fornecedor'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* 1. Identificação */}
        <div>
          <SectionTitle icon={Building2} label="Identificação" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status *</Label>
              <Select value={formData.status} onValueChange={(v: 'Ativo' | 'Inativo') => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={formData.supplierType} onValueChange={(v) => set('supplierType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                  <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Categoria principal</Label>
              <Select value={formData.mainCategory} onValueChange={(v) => set('mainCategory', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {SUPPLIER_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Razão social *</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                placeholder="Nome completo da empresa ou pessoa"
                required
              />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input
                value={formData.tradeName}
                onChange={(e) => set('tradeName', e.target.value)}
                placeholder="Como é conhecido no mercado"
              />
            </div>
            <div>
              <Label>{formData.supplierType === 'PF' ? 'CPF' : 'CNPJ'}</Label>
              <Input
                value={formData.cnpjCpf}
                onChange={(e) => set('cnpjCpf', e.target.value)}
                placeholder={formData.supplierType === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
              />
            </div>
            {formData.supplierType === 'PJ' && (
              <div>
                <Label>Inscrição Estadual (IE)</Label>
                <Input
                  value={formData.stateRegistration}
                  onChange={(e) => set('stateRegistration', e.target.value)}
                  placeholder="Ex: 123.456.789.000"
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* 2. Contatos */}
        <div>
          <SectionTitle icon={User} label="Contatos" />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome do contato principal</Label>
              <Input
                value={formData.contactName}
                onChange={(e) => set('contactName', e.target.value)}
                placeholder="Nome da pessoa de referência"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(11) 3000-0000"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contato@empresa.com.br"
              />
            </div>
            <div>
              <Label>Site / Instagram</Label>
              <Input
                value={formData.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="www.empresa.com.br ou @empresa"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* 3. Localização */}
        <div>
          <SectionTitle icon={MapPin} label="Localização" />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>CEP</Label>
              <Input
                value={formData.zipCode}
                onChange={(e) => set('zipCode', e.target.value)}
                placeholder="00000-000"
              />
            </div>
            <div className="col-span-2">
              <Label>Endereço (rua, número, complemento)</Label>
              <Input
                value={formData.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Rua das Flores, 123, Sala 4"
              />
            </div>
            <div className="col-span-1">
              <Label>Cidade</Label>
              <Input
                value={formData.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="São Paulo"
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={formData.state} onValueChange={(v) => set('state', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distância da sede (km)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.distanceKm}
                onChange={(e) => set('distanceKm', e.target.value)}
                placeholder="Ex: 12"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* 4. Condições comerciais */}
        <div>
          <SectionTitle icon={DollarSign} label="Condições comerciais" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prazo de pagamento (dias)</Label>
              <Input
                type="number"
                min="0"
                value={formData.paymentTerms}
                onChange={(e) => set('paymentTerms', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Forma preferencial de pagamento</Label>
              <Select value={formData.paymentMethodPreferred} onValueChange={(v) => set('paymentMethodPreferred', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Chave PIX</Label>
              <Input
                value={formData.pixKey}
                onChange={(e) => set('pixKey', e.target.value)}
                placeholder="CNPJ, CPF, e-mail, telefone ou chave aleatória"
              />
            </div>
            <div>
              <Label>Valor mínimo do pedido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumOrderValue}
                onChange={(e) => set('minimumOrderValue', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Lead time médio (dias)</Label>
              <Input
                type="number"
                min="0"
                value={formData.leadTimeDays}
                onChange={(e) => set('leadTimeDays', parseInt(e.target.value) || 0)}
                placeholder="Ex: 3"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* 5. Observações e avaliação */}
        <div>
          <SectionTitle icon={Star} label="Avaliação e observações" />
          <div className="space-y-4">
            <div>
              <Label>Avaliação interna (1 = ruim, 5 = excelente)</Label>
              <Select value={formData.rating} onValueChange={(v) => set('rating', v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Sem avaliação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ Excelente</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ Bom</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ Regular</SelectItem>
                  <SelectItem value="2">⭐⭐ Ruim</SelectItem>
                  <SelectItem value="1">⭐ Muito ruim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Produtos fornecidos, histórico de relacionamento, pendências, etc."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting
              ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />{supplier ? 'Salvando...' : 'Cadastrando...'}</>
              : supplier ? 'Salvar alterações' : 'Cadastrar fornecedor'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>

      </form>
    </div>
  );
};

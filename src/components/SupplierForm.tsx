import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  contactName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  distanceKm?: number;
  paymentTerms: number;
  paymentMethodPreferred?: string;
  pixKey?: string;
  minimumOrderValue: number;
  leadTimeDays?: number;
  rating?: number;
  notes?: string;
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

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSubmit: (supplier: Omit<Supplier, 'id' | 'code'>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b">
    <Icon className="h-4 w-4 text-primary" />
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">{label}</h3>
  </div>
);


export const SupplierForm = ({ supplier, onSubmit, onCancel, isSubmitting = false }: SupplierFormProps) => {
  const [formData, setFormData] = useState({
    status: supplier?.status ?? ('Ativo' as const),
    companyName: supplier?.companyName ?? '',
    tradeName: supplier?.tradeName ?? '',
    supplierType: supplier?.supplierType ?? 'PJ',
    cnpjCpf: supplier?.cnpjCpf ?? '',
    stateRegistration: supplier?.stateRegistration ?? '',
    mainCategory: supplier?.mainCategory ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    whatsapp: supplier?.whatsapp ?? '',
    email: supplier?.email ?? '',
    website: supplier?.website ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    state: supplier?.state ?? '',
    zipCode: supplier?.zipCode ?? '',
    distanceKm: supplier?.distanceKm ?? ('' as number | ''),
    paymentTerms: supplier?.paymentTerms ?? 30,
    paymentMethodPreferred: supplier?.paymentMethodPreferred ?? 'PIX',
    pixKey: supplier?.pixKey ?? '',
    minimumOrderValue: supplier?.minimumOrderValue ?? 0,
    leadTimeDays: supplier?.leadTimeDays ?? 3,
    rating: supplier?.rating ?? ('' as number | ''),
    notes: supplier?.notes ?? '',
  });

  const set = (field: keyof typeof formData, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      alert('Razão Social é obrigatória');
      return;
    }
    onSubmit({
      ...formData,
      distanceKm: formData.distanceKm === '' ? undefined : Number(formData.distanceKm),
      rating: formData.rating === '' ? undefined : Number(formData.rating),
    });
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {supplier ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}
        </CardTitle>
        <CardDescription>
          {supplier ? 'Atualize as informações do fornecedor' : 'Adicione um novo fornecedor ao sistema'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* 1. Identificação */}
          <section>
            <SectionTitle icon={Building2} label="Identificação" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={formData.status} onValueChange={v => set('status', v as 'Ativo' | 'Inativo')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.supplierType} onValueChange={v => set('supplierType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                    <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria Principal</Label>
                <Select value={formData.mainCategory} onValueChange={v => set('mainCategory', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input
                  value={formData.companyName}
                  onChange={e => set('companyName', e.target.value)}
                  placeholder="Nome da empresa"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.tradeName}
                  onChange={e => set('tradeName', e.target.value)}
                  placeholder="Nome comercial"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>CNPJ / CPF</Label>
                <Input
                  value={formData.cnpjCpf}
                  onChange={e => set('cnpjCpf', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input
                  value={formData.stateRegistration}
                  onChange={e => set('stateRegistration', e.target.value)}
                  placeholder="Isento ou número"
                />
              </div>
            </div>
          </section>

          {/* 2. Contatos */}
          <section>
            <SectionTitle icon={User} label="Contatos" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Contato</Label>
                <Input
                  value={formData.contactName}
                  onChange={e => set('contactName', e.target.value)}
                  placeholder="Responsável comercial"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="(11) 3333-4444"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={formData.whatsapp}
                  onChange={e => set('whatsapp', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={e => set('website', e.target.value)}
                placeholder="https://empresa.com.br"
              />
            </div>
          </section>

          {/* 3. Localização */}
          <section>
            <SectionTitle icon={MapPin} label="Localização" />
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={e => set('address', e.target.value)}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="col-span-2 space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={e => set('city', e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={formData.state} onValueChange={v => set('state', v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={formData.zipCode}
                  onChange={e => set('zipCode', e.target.value)}
                  placeholder="00000-000"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2 max-w-xs">
              <Label>Distância da sede (km)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.distanceKm}
                onChange={e => set('distanceKm', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Ex: 12.5"
              />
            </div>
          </section>

          {/* 4. Condições Comerciais */}
          <section>
            <SectionTitle icon={DollarSign} label="Condições Comerciais" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo de Pagamento (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.paymentTerms}
                  onChange={e => set('paymentTerms', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento Preferida</Label>
                <Select value={formData.paymentMethodPreferred} onValueChange={v => set('paymentMethodPreferred', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Transferência">Transferência (TED/DOC)</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pixKey}
                  onChange={e => set('pixKey', e.target.value)}
                  placeholder="CNPJ, CPF, e-mail ou telefone"
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minimumOrderValue}
                  onChange={e => set('minimumOrderValue', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2 max-w-xs">
              <Label>Lead time médio (dias)</Label>
              <Input
                type="number"
                min="0"
                value={formData.leadTimeDays}
                onChange={e => set('leadTimeDays', parseInt(e.target.value) || 0)}
              />
            </div>
          </section>

          {/* 5. Avaliação e Observações */}
          <section>
            <SectionTitle icon={Star} label="Avaliação e Observações" />
            <div className="space-y-2 max-w-xs mb-4">
              <Label>Avaliação (1–5)</Label>
              <Select
                value={formData.rating === '' ? '' : String(formData.rating)}
                onValueChange={v => set('rating', v === '' ? '' : parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Sem avaliação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ — Excelente</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ — Bom</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ — Regular</SelectItem>
                  <SelectItem value="2">⭐⭐ — Ruim</SelectItem>
                  <SelectItem value="1">⭐ — Péssimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Histórico, condições especiais, alertas..."
                rows={3}
              />
            </div>
          </section>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {supplier ? 'Atualizando...' : 'Cadastrando...'}
                </span>
              ) : (
                supplier ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

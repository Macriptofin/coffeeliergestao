import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { todayLocalISO } from "@/lib/date-utils";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Shield, Download, Search, Users, TrendingUp, Clock, MapPin,
  Phone, Mail, Globe, Star, Building2
} from "lucide-react";
import { SupplierForm, Supplier, SUPPLIER_CATEGORIES } from "@/components/SupplierForm";
import { SuppliersList } from "@/components/SuppliersList";
import { useUserRole } from "@/hooks/useUserRole";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDocument = (doc?: string) => {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
};

const mapRow = (item: any): Supplier => ({
  id: item.id,
  code: item.code,
  status: item.status as 'Ativo' | 'Inativo',
  companyName: item.company_name,
  tradeName: item.trade_name ?? undefined,
  supplierType: item.supplier_type ?? undefined,
  cnpjCpf: item.cnpj_cpf ?? undefined,
  stateRegistration: item.state_registration ?? undefined,
  mainCategory: item.main_category ?? undefined,
  contactName: item.contact_name ?? undefined,
  phone: item.phone ?? undefined,
  whatsapp: item.whatsapp ?? undefined,
  email: item.email ?? undefined,
  website: item.website ?? undefined,
  address: item.address ?? undefined,
  city: item.city ?? undefined,
  state: item.state ?? undefined,
  zipCode: item.zip_code ?? undefined,
  distanceKm: item.distance_km != null ? parseFloat(item.distance_km) : undefined,
  paymentTerms: item.payment_terms ?? 30,
  paymentMethodPreferred: item.payment_method_preferred ?? undefined,
  pixKey: item.pix_key ?? undefined,
  minimumOrderValue: parseFloat(item.minimum_order_value?.toString() ?? '0'),
  leadTimeDays: item.lead_time_days ?? undefined,
  rating: item.rating ?? undefined,
  notes: item.notes ?? undefined,
});

interface SuppliersData {
  suppliers: Supplier[];
  ytdSpend: Record<string, number>;
}

const EMPTY_SUPPLIERS_DATA: SuppliersData = { suppliers: [], ytdSpend: {} };

async function fetchSuppliersData(): Promise<SuppliersData> {
  const [suppliersRes, spendRes] = await Promise.all([
    supabase.from('suppliers').select('*').order('company_name'),
    supabase
      .from('accounts_payable')
      .select('supplier_id, original_amount')
      .gte('due_date', `${new Date().getFullYear()}-01-01`)
      .lte('due_date', `${new Date().getFullYear()}-12-31`),
  ]);

  if (suppliersRes.error) throw suppliersRes.error;

  const spend: Record<string, number> = {};
  (spendRes.data ?? []).forEach((row: any) => {
    if (row.supplier_id) {
      spend[row.supplier_id] = (spend[row.supplier_id] ?? 0) + parseFloat(row.original_amount ?? '0');
    }
  });

  return {
    suppliers: (suppliersRes.data ?? []).map(mapRow),
    ytdSpend: spend,
  };
}

const Suppliers = () => {
  const { can, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();

  const {
    data: { suppliers, ytdSpend } = EMPTY_SUPPLIERS_DATA,
    isPending: loading,
    isError,
  } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliersData });

  const showLoader = useDelayedLoading(loading);
  const [submitting, setSubmitting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'spend_desc' | 'distance' | 'lead_time'>('name');

  // Erro de carregamento → toast (uma vez por mudança no estado de erro)
  useEffect(() => {
    if (isError) toast.error('Erro ao carregar fornecedores');
  }, [isError]);

  // Após mutações, invalida a query de fornecedores
  const refetchSuppliers = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] });

  const addSupplier = async (data: Omit<Supplier, 'id' | 'code'>) => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('suppliers')
        .insert({
          code: null,
          status: data.status,
          company_name: data.companyName,
          trade_name: data.tradeName || null,
          supplier_type: data.supplierType || null,
          cnpj_cpf: data.cnpjCpf || null,
          state_registration: data.stateRegistration || null,
          main_category: data.mainCategory || null,
          contact_name: data.contactName || null,
          phone: data.phone || null,
          whatsapp: data.whatsapp || null,
          email: data.email || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zipCode || null,
          distance_km: data.distanceKm ?? null,
          payment_terms: data.paymentTerms,
          payment_method_preferred: data.paymentMethodPreferred || null,
          pix_key: data.pixKey || null,
          minimum_order_value: data.minimumOrderValue,
          lead_time_days: data.leadTimeDays ?? null,
          rating: data.rating ?? null,
          notes: data.notes || null,
        });

      if (error) throw error;
      refetchSuppliers();
      setShowForm(false);
      toast.success('Fornecedor cadastrado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao cadastrar fornecedor');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSupplier = async (updated: Supplier) => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('suppliers')
        .update({
          status: updated.status,
          company_name: updated.companyName,
          trade_name: updated.tradeName || null,
          supplier_type: updated.supplierType || null,
          cnpj_cpf: updated.cnpjCpf || null,
          state_registration: updated.stateRegistration || null,
          main_category: updated.mainCategory || null,
          contact_name: updated.contactName || null,
          phone: updated.phone || null,
          whatsapp: updated.whatsapp || null,
          email: updated.email || null,
          website: updated.website || null,
          address: updated.address || null,
          city: updated.city || null,
          state: updated.state || null,
          zip_code: updated.zipCode || null,
          distance_km: updated.distanceKm ?? null,
          payment_terms: updated.paymentTerms,
          payment_method_preferred: updated.paymentMethodPreferred || null,
          pix_key: updated.pixKey || null,
          minimum_order_value: updated.minimumOrderValue,
          lead_time_days: updated.leadTimeDays ?? null,
          rating: updated.rating ?? null,
          notes: updated.notes || null,
        })
        .eq('id', updated.id);

      if (error) throw error;
      refetchSuppliers();
      setEditingSupplier(null);
      setShowForm(false);
      toast.success('Fornecedor atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar fornecedor');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      refetchSuppliers();
      toast.success('Fornecedor excluído com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const handleSubmit = (data: Omit<Supplier, 'id' | 'code'>) => {
    if (editingSupplier) {
      updateSupplier({ ...data, id: editingSupplier.id, code: editingSupplier.code });
    } else {
      addSupplier(data);
    }
  };

  const exportCSV = () => {
    try {
      const header = ['Código','Status','Razão Social','Nome Fantasia','CNPJ/CPF','Categoria',
        'Contato','Telefone','WhatsApp','Email','Cidade','Estado','Distância (km)',
        'Prazo Pgto (dias)','Lead time (dias)','Pedido mín.','Avaliação','Observações'];
      const rows = suppliers.map(s => [
        s.code, s.status, s.companyName, s.tradeName ?? '', s.cnpjCpf ?? '',
        s.mainCategory ?? '', s.contactName ?? '', s.phone ?? '', s.whatsapp ?? '',
        s.email ?? '', s.city ?? '', s.state ?? '',
        s.distanceKm != null ? s.distanceKm : '',
        s.paymentTerms, s.leadTimeDays ?? '', s.minimumOrderValue,
        s.rating ?? '', s.notes ?? '',
      ]);
      const csv = [header, ...rows].map(r => r.map(f => `"${f}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fornecedores_${todayLocalISO()}.csv`;
      link.click();
      toast.success(`CSV exportado com ${suppliers.length} fornecedores`);
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  };

  // Derived metrics
  const activeSuppliers = suppliers.filter(s => s.status === 'Ativo');
  const totalSpend = Object.values(ytdSpend).reduce((a, b) => a + b, 0);
  const avgLeadTime = activeSuppliers.filter(s => s.leadTimeDays).length
    ? Math.round(activeSuppliers.filter(s => s.leadTimeDays).reduce((a, s) => a + (s.leadTimeDays ?? 0), 0) / activeSuppliers.filter(s => s.leadTimeDays).length)
    : null;
  const avgDistance = activeSuppliers.filter(s => s.distanceKm != null).length
    ? Math.round(activeSuppliers.filter(s => s.distanceKm != null).reduce((a, s) => a + (s.distanceKm ?? 0), 0) / activeSuppliers.filter(s => s.distanceKm != null).length)
    : null;

  // Filtered & sorted list
  const filtered = suppliers
    .filter(s => {
      if (filterStatus === 'ativo' && s.status !== 'Ativo') return false;
      if (filterStatus === 'inativo' && s.status !== 'Inativo') return false;
      if (filterCategory !== 'all' && s.mainCategory !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.companyName.toLowerCase().includes(q) &&
          !(s.tradeName ?? '').toLowerCase().includes(q) &&
          !(s.cnpjCpf ?? '').includes(q) &&
          !(s.code ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'spend_desc') return (ytdSpend[b.id] ?? 0) - (ytdSpend[a.id] ?? 0);
      if (sortBy === 'distance') return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
      if (sortBy === 'lead_time') return (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999);
      return a.companyName.localeCompare(b.companyName, 'pt-BR');
    });

  if (showLoader || roleLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!can('fornecedores', 'view')) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gestão de Fornecedores</h1>
          <p className="text-muted-foreground">Acesso restrito — seu perfil de acesso não inclui o módulo Fornecedores</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Alert className="border-amber-200 bg-amber-50">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Acesso Restrito:</strong> Esta seção contém informações confidenciais de fornecedores.
                O acesso é limitado a administradores e gerentes.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Gestão de Fornecedores</h1>
          <p className="text-muted-foreground text-sm">Cadastro e desempenho dos fornecedores da Coffeelier</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={suppliers.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
            onClick={() => { setEditingSupplier(null); setShowForm(true); }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fornecedores ativos</p>
                <p className="text-2xl font-bold">{activeSuppliers.length}</p>
                <p className="text-xs text-muted-foreground">de {suppliers.length} cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gasto total {new Date().getFullYear()}</p>
                <p className="text-xl font-bold">{formatCurrency(totalSpend)}</p>
                <p className="text-xs text-muted-foreground">em contas a pagar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lead time médio</p>
                <p className="text-2xl font-bold">{avgLeadTime != null ? `${avgLeadTime}d` : '—'}</p>
                <p className="text-xs text-muted-foreground">dias úteis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MapPin className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Distância média</p>
                <p className="text-2xl font-bold">{avgDistance != null ? `${avgDistance} km` : '—'}</p>
                <p className="text-xs text-muted-foreground">da sede</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-8">
          <SupplierForm
            supplier={editingSupplier}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingSupplier(null); }}
            isSubmitting={submitting}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {SUPPLIER_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="spend_desc">Maior gasto</SelectItem>
            <SelectItem value="distance">Distância</SelectItem>
            <SelectItem value="lead_time">Lead time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} fornecedor(es)</p>

      {/* List */}
      <SuppliersList
        suppliers={filtered}
        ytdSpend={ytdSpend}
        onView={(s) => setViewingSupplier(s)}
        onEdit={(s) => { setEditingSupplier(s); setShowForm(true); }}
        onDelete={deleteSupplier}
      />

      {/* Detail drawer */}
      <Dialog open={!!viewingSupplier} onOpenChange={open => { if (!open) setViewingSupplier(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewingSupplier && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {viewingSupplier.companyName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${viewingSupplier.status === 'Ativo' ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                  <span className="text-xs text-muted-foreground font-mono">{viewingSupplier.code}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{viewingSupplier.status}</span>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Identificação */}
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Identificação</h4>
                  <div className="space-y-1 text-sm">
                    {viewingSupplier.tradeName && <p><span className="text-muted-foreground">Fantasia:</span> {viewingSupplier.tradeName}</p>}
                    {viewingSupplier.cnpjCpf && <p><span className="text-muted-foreground">CNPJ/CPF:</span> {formatDocument(viewingSupplier.cnpjCpf)}</p>}
                    {viewingSupplier.stateRegistration && <p><span className="text-muted-foreground">IE:</span> {viewingSupplier.stateRegistration}</p>}
                    {viewingSupplier.mainCategory && <p><span className="text-muted-foreground">Categoria:</span> {viewingSupplier.mainCategory}</p>}
                  </div>
                </section>

                {/* Contatos */}
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Contatos</h4>
                  <div className="space-y-1 text-sm">
                    {viewingSupplier.contactName && <p>{viewingSupplier.contactName}</p>}
                    {viewingSupplier.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {viewingSupplier.phone}
                      </p>
                    )}
                    {viewingSupplier.whatsapp && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {viewingSupplier.whatsapp} (WhatsApp)
                      </p>
                    )}
                    {viewingSupplier.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {viewingSupplier.email}
                      </p>
                    )}
                    {viewingSupplier.website && (
                      <p className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {viewingSupplier.website}
                      </p>
                    )}
                  </div>
                </section>

                {/* Localização */}
                {(viewingSupplier.address || viewingSupplier.city || viewingSupplier.distanceKm != null) && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Localização</h4>
                    <div className="space-y-1 text-sm">
                      {viewingSupplier.address && <p>{viewingSupplier.address}</p>}
                      {(viewingSupplier.city || viewingSupplier.state) && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[viewingSupplier.city, viewingSupplier.state, viewingSupplier.zipCode].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {viewingSupplier.distanceKm != null && (
                        <p className="text-muted-foreground">{viewingSupplier.distanceKm} km da sede</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Comercial */}
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Condições Comerciais</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Prazo:</span> {viewingSupplier.paymentTerms} dias</p>
                    {viewingSupplier.paymentMethodPreferred && <p><span className="text-muted-foreground">Pagamento preferido:</span> {viewingSupplier.paymentMethodPreferred}</p>}
                    {viewingSupplier.pixKey && <p><span className="text-muted-foreground">Chave PIX:</span> {viewingSupplier.pixKey}</p>}
                    {viewingSupplier.minimumOrderValue > 0 && <p><span className="text-muted-foreground">Pedido mínimo:</span> {formatCurrency(viewingSupplier.minimumOrderValue)}</p>}
                    {viewingSupplier.leadTimeDays != null && <p><span className="text-muted-foreground">Lead time:</span> {viewingSupplier.leadTimeDays} dias</p>}
                  </div>
                </section>

                {/* YTD */}
                {ytdSpend[viewingSupplier.id] > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Histórico {new Date().getFullYear()}</h4>
                    <p className="text-lg font-bold">{formatCurrency(ytdSpend[viewingSupplier.id])}</p>
                    <p className="text-xs text-muted-foreground">total em contas a pagar</p>
                  </section>
                )}

                {/* Avaliação */}
                {(viewingSupplier.rating || viewingSupplier.notes) && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Avaliação</h4>
                    {viewingSupplier.rating && (
                      <p className="text-amber-500 text-lg mb-1">
                        {'★'.repeat(viewingSupplier.rating)}{'☆'.repeat(5 - viewingSupplier.rating)}
                      </p>
                    )}
                    {viewingSupplier.notes && <p className="text-sm text-muted-foreground">{viewingSupplier.notes}</p>}
                  </section>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  className="flex-1"
                  onClick={() => { setViewingSupplier(null); setEditingSupplier(viewingSupplier); setShowForm(true); }}
                >
                  Editar fornecedor
                </Button>
                <Button variant="outline" onClick={() => setViewingSupplier(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;

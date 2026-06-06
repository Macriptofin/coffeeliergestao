import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Building2, Download, Plus, Search, Shield,
  Phone, MessageCircle, Mail, Globe, MapPin,
  Clock, CreditCard, Package, Star, Pencil, X
} from "lucide-react";
import { SupplierForm, Supplier, SUPPLIER_CATEGORIES } from "@/components/SupplierForm";
import { SuppliersList } from "@/components/SuppliersList";
import { useUserRole } from "@/hooks/useUserRole";

const SORT_OPTIONS = [
  { value: 'name', label: 'Nome A–Z' },
  { value: 'spend_desc', label: 'Maior volume' },
  { value: 'distance', label: 'Menor distância' },
  { value: 'lead_time', label: 'Menor lead time' },
];

const RATING_LABELS: Record<number, string> = { 5:'⭐⭐⭐⭐⭐', 4:'⭐⭐⭐⭐', 3:'⭐⭐⭐', 2:'⭐⭐', 1:'⭐' };

const Suppliers = () => {
  const { isAdminOrManager, loading: roleLoading } = useUserRole();
  const [suppliers, setSuppliers]       = useState<Supplier[]>([]);
  const [ytdSpend, setYtdSpend]         = useState<Record<string, number>>({});
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [search, setSearch]             = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy]             = useState('name');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const year = new Date().getFullYear();
      const [suppRes, spendRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('company_name'),
        supabase
          .from('accounts_payable')
          .select('supplier_id, original_amount')
          .neq('status', 'Cancelado')
          .gte('issue_date', `${year}-01-01`)
          .lte('issue_date', `${year}-12-31`)
      ]);
      if (suppRes.error) throw suppRes.error;

      const mapped: Supplier[] = (suppRes.data || []).map(r => ({
        id:                     r.id,
        code:                   r.code,
        status:                 r.status as 'Ativo' | 'Inativo',
        companyName:            r.company_name,
        tradeName:              r.trade_name || undefined,
        supplierType:           r.supplier_type || 'PJ',
        cnpjCpf:                r.cnpj_cpf || undefined,
        stateRegistration:      r.state_registration || undefined,
        mainCategory:           r.main_category || undefined,
        contactName:            r.contact_name || undefined,
        phone:                  r.phone || undefined,
        whatsapp:               r.whatsapp || undefined,
        email:                  r.email || undefined,
        website:                r.website || undefined,
        address:                r.address || undefined,
        city:                   r.city || undefined,
        state:                  r.state || undefined,
        zipCode:                r.zip_code || undefined,
        distanceKm:             r.distance_km ? parseFloat(r.distance_km) : undefined,
        paymentTerms:           r.payment_terms || 30,
        paymentMethodPreferred: r.payment_method_preferred || 'PIX',
        pixKey:                 r.pix_key || undefined,
        minimumOrderValue:      parseFloat(r.minimum_order_value?.toString() || '0'),
        leadTimeDays:           r.lead_time_days || undefined,
        rating:                 r.rating || undefined,
        notes:                  r.notes || undefined,
      }));
      setSuppliers(mapped);

      // Agrupa gasto YTD por supplier_id
      const spendMap: Record<string, number> = {};
      (spendRes.data || []).forEach(row => {
        if (row.supplier_id) {
          spendMap[row.supplier_id] = (spendMap[row.supplier_id] || 0) + parseFloat(row.original_amount);
        }
      });
      setYtdSpend(spendMap);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  // Métricas do cabeçalho
  const metrics = useMemo(() => {
    const active       = suppliers.filter(s => s.status === 'Ativo');
    const totalSpend   = Object.values(ytdSpend).reduce((a, b) => a + b, 0);
    const withLead     = suppliers.filter(s => s.leadTimeDays);
    const avgLead      = withLead.length ? withLead.reduce((a, s) => a + (s.leadTimeDays || 0), 0) / withLead.length : 0;
    const withDist     = suppliers.filter(s => s.distanceKm);
    const avgDist      = withDist.length ? withDist.reduce((a, s) => a + (s.distanceKm || 0), 0) / withDist.length : 0;
    return { total: suppliers.length, active: active.length, totalSpend, avgLead, avgDist };
  }, [suppliers, ytdSpend]);

  // Filtro e ordenação
  const filtered = useMemo(() => {
    let list = suppliers.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        s.companyName.toLowerCase().includes(q) ||
        s.tradeName?.toLowerCase().includes(q) ||
        s.cnpjCpf?.includes(q) ||
        s.contactName?.toLowerCase().includes(q);
      const matchCat    = categoryFilter === 'all' || s.mainCategory === categoryFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'spend_desc') return (ytdSpend[b.id] || 0) - (ytdSpend[a.id] || 0);
      if (sortBy === 'distance')  return (a.distanceKm || 9999) - (b.distanceKm || 9999);
      if (sortBy === 'lead_time') return (a.leadTimeDays || 9999) - (b.leadTimeDays || 9999);
      return a.companyName.localeCompare(b.companyName);
    });
    return list;
  }, [suppliers, ytdSpend, search, categoryFilter, statusFilter, sortBy]);

  const handleSubmit = async (data: Omit<Supplier, 'id' | 'code'>) => {
    try {
      setSubmitting(true);
      const payload = {
        status:                   data.status,
        company_name:             data.companyName,
        trade_name:               data.tradeName || null,
        supplier_type:            data.supplierType || 'PJ',
        cnpj_cpf:                 data.cnpjCpf || null,
        state_registration:       data.stateRegistration || null,
        main_category:            data.mainCategory || null,
        contact_name:             data.contactName || null,
        phone:                    data.phone || null,
        whatsapp:                 data.whatsapp || null,
        email:                    data.email || null,
        website:                  data.website || null,
        address:                  data.address || null,
        city:                     data.city || null,
        state:                    data.state || null,
        zip_code:                 data.zipCode || null,
        distance_km:              data.distanceKm || null,
        payment_terms:            data.paymentTerms,
        payment_method_preferred: data.paymentMethodPreferred || 'PIX',
        pix_key:                  data.pixKey || null,
        minimum_order_value:      data.minimumOrderValue,
        lead_time_days:           data.leadTimeDays || null,
        rating:                   data.rating || null,
        notes:                    data.notes || null,
      };

      if (editingSupplier) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id);
        if (error) throw error;
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('suppliers').insert({ ...payload, code: null });
        if (error) throw error;
        toast.success('Fornecedor cadastrado com sucesso!');
      }
      setShowForm(false);
      setEditingSupplier(null);
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar fornecedor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Fornecedor excluído');
      loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const startEdit = (s: Supplier) => { setEditingSupplier(s); setShowForm(true); };
  const cancelForm = () => { setEditingSupplier(null); setShowForm(false); };

  const exportCSV = () => {
    const header = ['Código','Status','Tipo','Razão Social','Nome Fantasia','CNPJ/CPF','IE','Categoria','Contato','Telefone','WhatsApp','Email','Site','CEP','Endereço','Cidade','Estado','Dist (km)','Prazo Pgto','Forma Pgto','PIX','Vl Mínimo','Lead time','Avaliação','Observações'];
    const rows = suppliers.map(s => [
      s.code, s.status, s.supplierType, s.companyName, s.tradeName||'', s.cnpjCpf||'',
      s.stateRegistration||'', s.mainCategory||'', s.contactName||'', s.phone||'',
      s.whatsapp||'', s.email||'', s.website||'', s.zipCode||'', s.address||'',
      s.city||'', s.state||'', s.distanceKm||'', s.paymentTerms, s.paymentMethodPreferred||'',
      s.pixKey||'', s.minimumOrderValue, s.leadTimeDays||'', s.rating||'', s.notes||''
    ]);
    const csv = [header, ...rows].map(r => r.map(f => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fornecedores_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${suppliers.length} fornecedores exportados`);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading || roleLoading) {
    return <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!isAdminOrManager()) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Gestão de Fornecedores</h1>
          <p className="text-muted-foreground">Acesso restrito a administradores e gerentes</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Informações protegidas</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-amber-200 bg-amber-50">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Esta seção contém dados fiscais e comerciais confidenciais. Acesso restrito a administradores e gerentes.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Gestão de fornecedores</h1>
          <p className="text-muted-foreground text-sm">{metrics.total} fornecedores cadastrados · {metrics.active} ativos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={suppliers.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button onClick={() => { setEditingSupplier(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Fornecedores ativos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{metrics.active} <span className="text-sm text-muted-foreground font-normal">/ {metrics.total}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Gasto total ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{fmt(metrics.totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Lead time médio</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{metrics.avgLead ? `${metrics.avgLead.toFixed(1)} dias` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Distância média</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold">{metrics.avgDist ? `${metrics.avgDist.toFixed(1)} km` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulário */}
      {showForm && (
        <SupplierForm
          supplier={editingSupplier}
          onSubmit={handleSubmit}
          onCancel={cancelForm}
          isSubmitting={submitting}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ, contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {SUPPLIER_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <SuppliersList
        suppliers={filtered}
        ytdSpend={ytdSpend}
        onView={(s) => setViewingSupplier(s)}
        onEdit={startEdit}
        onDelete={handleDelete}
      />

      {/* Drawer de detalhes */}
      <Dialog open={!!viewingSupplier} onOpenChange={() => setViewingSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingSupplier && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {viewingSupplier.companyName}
                </DialogTitle>
                <DialogDescription>
                  {viewingSupplier.tradeName || viewingSupplier.mainCategory || ''}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mt-1">
                <Badge variant={viewingSupplier.status === 'Ativo' ? 'default' : 'secondary'}>{viewingSupplier.status}</Badge>
                <Badge variant="outline">{viewingSupplier.supplierType || 'PJ'}</Badge>
                {viewingSupplier.mainCategory && <Badge variant="outline">{viewingSupplier.mainCategory}</Badge>}
                {viewingSupplier.rating && <span className="text-sm">{RATING_LABELS[viewingSupplier.rating]}</span>}
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-6 text-sm">
                {/* Identificação */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identificação</p>
                  {viewingSupplier.cnpjCpf && <p><span className="text-muted-foreground">CNPJ/CPF: </span>{viewingSupplier.cnpjCpf}</p>}
                  {viewingSupplier.stateRegistration && <p><span className="text-muted-foreground">IE: </span>{viewingSupplier.stateRegistration}</p>}
                  <p><span className="text-muted-foreground">Código: </span>{viewingSupplier.code}</p>
                </div>

                {/* Contatos */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contatos</p>
                  {viewingSupplier.contactName && <p>{viewingSupplier.contactName}</p>}
                  {viewingSupplier.phone && (
                    <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{viewingSupplier.phone}</div>
                  )}
                  {viewingSupplier.whatsapp && (
                    <div className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />{viewingSupplier.whatsapp}</div>
                  )}
                  {viewingSupplier.email && (
                    <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{viewingSupplier.email}</div>
                  )}
                  {viewingSupplier.website && (
                    <div className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-muted-foreground" />{viewingSupplier.website}</div>
                  )}
                </div>

                {/* Localização */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Localização</p>
                  {viewingSupplier.address && (
                    <div className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" /><span>{viewingSupplier.address}{viewingSupplier.city ? `, ${viewingSupplier.city}` : ''}{viewingSupplier.state ? ` – ${viewingSupplier.state}` : ''}</span></div>
                  )}
                  {viewingSupplier.zipCode && <p><span className="text-muted-foreground">CEP: </span>{viewingSupplier.zipCode}</p>}
                  {viewingSupplier.distanceKm && <p><span className="text-muted-foreground">Distância: </span>{viewingSupplier.distanceKm} km da sede</p>}
                </div>

                {/* Condições comerciais */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condições comerciais</p>
                  <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span>Prazo: {viewingSupplier.paymentTerms} dias</span></div>
                  <div className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" /><span>{viewingSupplier.paymentMethodPreferred || 'PIX'}</span></div>
                  {viewingSupplier.pixKey && <p><span className="text-muted-foreground">PIX: </span>{viewingSupplier.pixKey}</p>}
                  {viewingSupplier.minimumOrderValue > 0 && <p><span className="text-muted-foreground">Pedido mínimo: </span>{fmt(viewingSupplier.minimumOrderValue)}</p>}
                  {viewingSupplier.leadTimeDays && (
                    <div className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-muted-foreground" /><span>Lead time: {viewingSupplier.leadTimeDays} dias</span></div>
                  )}
                </div>
              </div>

              {/* Histórico financeiro */}
              {ytdSpend[viewingSupplier.id] > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico financeiro ({new Date().getFullYear()})</p>
                    <p className="text-sm"><span className="text-muted-foreground">Total comprado: </span><strong>{fmt(ytdSpend[viewingSupplier.id])}</strong></p>
                  </div>
                </>
              )}

              {viewingSupplier.notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Observações</p>
                    <p className="text-sm text-muted-foreground">{viewingSupplier.notes}</p>
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-6">
                <Button className="flex-1" onClick={() => { setViewingSupplier(null); startEdit(viewingSupplier); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar fornecedor
                </Button>
                <Button variant="outline" onClick={() => setViewingSupplier(null)}>
                  <X className="h-4 w-4 mr-2" /> Fechar
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

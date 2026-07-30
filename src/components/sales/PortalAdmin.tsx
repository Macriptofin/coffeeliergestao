import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquareWarning, MapPinned, KeyRound, Settings2, Check, X, ShieldCheck, User,
} from 'lucide-react';
import { formatLocalDate } from '@/lib/date-utils';
import { toast } from 'sonner';

// Painel interno do Portal (admin "loja online"): acompanha e configura o canal do cliente.
// Catálogo do Portal não é mais curado por cliente aqui — é um flag global por produto
// ("Disponível no Portal", aba Precificação do cadastro do material).
export default function PortalAdmin() {
  return (
    <Tabs defaultValue="requests" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
        <TabsTrigger value="requests" className="gap-2 py-2"><MessageSquareWarning className="h-4 w-4" /><span className="hidden sm:inline">Solicitações</span></TabsTrigger>
        <TabsTrigger value="locations" className="gap-2 py-2"><MapPinned className="h-4 w-4" /><span className="hidden sm:inline">Locais a aprovar</span></TabsTrigger>
        <TabsTrigger value="access" className="gap-2 py-2"><KeyRound className="h-4 w-4" /><span className="hidden sm:inline">Acessos</span></TabsTrigger>
        <TabsTrigger value="config" className="gap-2 py-2"><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Configurações</span></TabsTrigger>
      </TabsList>
      <TabsContent value="requests" className="mt-6"><ChangeRequests /></TabsContent>
      <TabsContent value="locations" className="mt-6"><PendingLocations /></TabsContent>
      <TabsContent value="access" className="mt-6"><PortalAccess /></TabsContent>
      <TabsContent value="config" className="mt-6"><PortalConfig /></TabsContent>
    </Tabs>
  );
}

/* ---------- Solicitações de alteração ---------- */
function ChangeRequests() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({
    queryKey: ['portal-change-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_change_requests')
        .select('id, message, status, created_at, proposal_id, proposals(proposal_number), clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const setStatus = async (id: string, status: 'resolvida' | 'recusada') => {
    const { error } = await supabase.from('proposal_change_requests')
      .update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(status === 'resolvida' ? 'Marcada como resolvida.' : 'Solicitação recusada.');
    qc.invalidateQueries({ queryKey: ['portal-change-requests'] });
  };

  if (isPending) return <Loader />;
  if (data.length === 0) return <Empty icon={<MessageSquareWarning className="h-8 w-8" />} text="Nenhuma solicitação de alteração no momento." />;
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} className="shadow-soft">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{r.clients?.name || 'Cliente'}</span>
                  <span>· Proposta {r.proposals?.proposal_number || '—'}</span>
                  <span>· {r.created_at ? formatLocalDate(r.created_at) : ''}</span>
                </div>
                <p className="text-sm">{r.message}</p>
              </div>
              {r.status === 'aberta' ? (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setStatus(r.id, 'resolvida')}><Check className="h-4 w-4" /> Resolver</Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setStatus(r.id, 'recusada')}><X className="h-4 w-4" /> Recusar</Button>
                </div>
              ) : (
                <Badge variant={r.status === 'resolvida' ? 'secondary' : 'outline'} className="capitalize shrink-0">{r.status}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Locais sugeridos a aprovar ---------- */
function PendingLocations() {
  const qc = useQueryClient();
  const units = useQuery({
    queryKey: ['portal-pending-units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_units')
        .select('id, name, city, clients(name)').eq('approval_status', 'pending');
      if (error) throw error; return data as any[];
    },
  });
  const rooms = useQuery({
    queryKey: ['portal-pending-rooms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_rooms')
        .select('id, name, clients(name), client_units(name)').eq('approval_status', 'pending');
      if (error) throw error; return data as any[];
    },
  });
  const decide = async (table: 'client_units' | 'client_rooms', id: string, ok: boolean) => {
    const { error } = await supabase.from(table).update({ approval_status: ok ? 'approved' : 'rejected' }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(ok ? 'Local aprovado.' : 'Local recusado.');
    qc.invalidateQueries({ queryKey: ['portal-pending-units'] });
    qc.invalidateQueries({ queryKey: ['portal-pending-rooms'] });
  };

  if (units.isPending || rooms.isPending) return <Loader />;
  const list = [
    ...(units.data || []).map((u: any) => ({ ...u, kind: 'Unidade', table: 'client_units' as const, extra: u.city })),
    ...(rooms.data || []).map((r: any) => ({ ...r, kind: 'Sala', table: 'client_rooms' as const, extra: r.client_units?.name })),
  ];
  if (list.length === 0) return <Empty icon={<MapPinned className="h-8 w-8" />} text="Nenhum local aguardando aprovação." />;
  return (
    <div className="space-y-3">
      {list.map((it: any) => (
        <Card key={`${it.table}-${it.id}`} className="shadow-soft">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{it.clients?.name} · {it.kind}{it.extra ? ` · ${it.extra}` : ''}</div>
              <div className="font-medium">{it.name}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => decide(it.table, it.id, true)}><Check className="h-4 w-4" /> Aprovar</Button>
              <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => decide(it.table, it.id, false)}><X className="h-4 w-4" /> Recusar</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Acessos do portal ---------- */
function PortalAccess() {
  const qc = useQueryClient();
  const { data = [], isPending } = useQuery({
    queryKey: ['portal-all-access'],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_users')
        .select('id, user_id, portal_role, is_active, created_at, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length) {
        const { data: profs } = await supabase.from('user_profiles')
          .select('user_id, email, full_name').in('user_id', rows.map(r => r.user_id));
        const m = new Map((profs || []).map(p => [p.user_id, p]));
        rows.forEach(r => { r.email = m.get(r.user_id)?.email; r.full_name = m.get(r.user_id)?.full_name; });
      }
      return rows;
    },
  });
  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from('client_users').update({ is_active: !active }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(active ? 'Acesso desativado.' : 'Acesso reativado.');
    qc.invalidateQueries({ queryKey: ['portal-all-access'] });
  };

  if (isPending) return <Loader />;
  if (data.length === 0) return <Empty icon={<KeyRound className="h-8 w-8" />} text="Nenhum acesso de cliente criado ainda. Convide pelo cadastro do cliente." />;
  return (
    <div className="space-y-2">
      {data.map((u: any) => (
        <div key={u.id} className="flex items-center gap-3 border rounded-lg p-3 bg-card">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            {u.portal_role === 'aprovador' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{u.full_name || u.email || 'Usuário'}</div>
            <div className="text-xs text-muted-foreground truncate">{u.clients?.name} · {u.email}</div>
          </div>
          <Badge variant="secondary" className="capitalize">{u.portal_role}</Badge>
          {!u.is_active && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
          <Button variant="ghost" size="sm" onClick={() => toggle(u.id, u.is_active)}>{u.is_active ? 'Desativar' : 'Reativar'}</Button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Configurações do portal ---------- */
function PortalConfig() {
  const qc = useQueryClient();
  const [whatsapp, setWhatsapp] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ['portal-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
        .in('key', ['portal.whatsapp', 'portal.contact_email']);
      if (error) throw error;
      const m = new Map((data || []).map(d => [d.key, d.value]));
      setWhatsapp(m.get('portal.whatsapp') || '');
      setEmailContato(m.get('portal.contact_email') || '');
      setLoaded(true);
      return data;
    },
  });

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert([
        { key: 'portal.whatsapp', value: whatsapp.trim() },
        { key: 'portal.contact_email', value: emailContato.trim() },
      ], { onConflict: 'key' });
      if (error) throw error;
      toast.success('Configurações do portal salvas.');
      qc.invalidateQueries({ queryKey: ['portal-settings'] });
    } catch {
      toast.error('Erro ao salvar.');
    } finally { setSaving(false); }
  };

  return (
    <Card className="shadow-soft max-w-2xl">
      <CardHeader><CardTitle className="text-lg">Contato e atendimento</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usado nos botões "Falar com a Coffeelier" do portal do cliente.
        </p>
        <div className="space-y-1.5">
          <Label>WhatsApp (somente números, com DDI/DDD)</Label>
          <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5551999999999" disabled={!loaded} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail de contato</Label>
          <Input type="email" value={emailContato} onChange={e => setEmailContato(e.target.value)} placeholder="contato@coffeelier.com.br" disabled={!loaded} />
        </div>
        <Button onClick={save} disabled={saving || !loaded}>{saving ? 'Salvando…' : 'Salvar configurações'}</Button>
      </CardContent>
    </Card>
  );
}


/* ---------- helpers de UI ---------- */
function Loader() {
  return <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" /></div>;
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
      <div className="mx-auto mb-3 opacity-40 w-fit">{icon}</div>{text}
    </div>
  );
}

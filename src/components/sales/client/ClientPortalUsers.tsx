import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserPlus, Mail, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

interface PortalUserRow {
  id: string; user_id: string; portal_role: string; is_active: boolean; created_at: string;
  email?: string | null; full_name?: string | null;
}

// Gestão de acessos do cliente ao portal de autoatendimento (convite "através do cliente").
export default function ClientPortalUsers({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'solicitante' | 'aprovador'>('solicitante');
  const [sending, setSending] = useState(false);

  const { data: users = [], isPending } = useQuery({
    queryKey: ['client-portal-users', clientId],
    queryFn: async (): Promise<PortalUserRow[]> => {
      const { data, error } = await supabase
        .from('client_users')
        .select('id, user_id, portal_role, is_active, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as PortalUserRow[];
      if (rows.length === 0) return rows;
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, email, full_name')
        .in('user_id', rows.map(r => r.user_id));
      const byId = new Map((profiles || []).map(p => [p.user_id, p]));
      return rows.map(r => ({ ...r, email: byId.get(r.user_id)?.email, full_name: byId.get(r.user_id)?.full_name }));
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['client-portal-users', clientId] });

  const handleInvite = async () => {
    if (!email.trim()) { toast.info('Informe o e-mail do usuário.'); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-client-user', {
        body: { email: email.trim(), full_name: fullName.trim() || null, client_id: clientId, portal_role: role },
      });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      toast.success((data as any)?.message || 'Convite enviado!');
      setEmail(''); setFullName(''); setRole('solicitante');
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar o convite.');
    } finally { setSending(false); }
  };

  const toggleActive = async (u: PortalUserRow) => {
    const { error } = await supabase.from('client_users').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) { toast.error('Erro ao atualizar acesso.'); return; }
    toast.success(u.is_active ? 'Acesso desativado.' : 'Acesso reativado.');
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Convite */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <h3 className="font-semibold flex items-center gap-2 mb-1"><UserPlus className="h-4 w-4" /> Convidar usuário do portal</h3>
        <p className="text-sm text-muted-foreground mb-4">
          O usuário recebe um e-mail para definir a senha e já entra vinculado a este cliente, com as condições de pagamento e a estrutura (unidades, salas, contatos) prontas.
        </p>
        <div className="grid md:grid-cols-[1fr_1fr_180px_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome (opcional)</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nome do solicitante" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solicitante">Solicitante</SelectItem>
                <SelectItem value="aprovador">Aprovador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} disabled={sending} className="gap-2">
            <Mail className="h-4 w-4" /> {sending ? 'Enviando…' : 'Enviar convite'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          <strong>Solicitante</strong> monta e acompanha pedidos. <strong>Aprovador</strong> também pode aprovar a proposta.
        </p>
      </div>

      {/* Lista */}
      {isPending ? (
        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário do portal ainda. Convide o primeiro acima.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 border rounded-lg p-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {u.portal_role === 'aprovador' ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.full_name || u.email || 'Usuário'}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <Badge variant="secondary" className="capitalize">{u.portal_role}</Badge>
              {!u.is_active && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
              <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                {u.is_active ? 'Desativar' : 'Reativar'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

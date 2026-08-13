import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, Plus, Trash2, Users } from "lucide-react";
import { ACCESS_MODULES, ACCESS_ACTIONS } from "@/lib/accessModules";

interface AccessProfile {
  id: string;
  role_name: string;
  label: string;
  description: string | null;
  is_system: boolean | null;
}

const PROFILES_QUERY_KEY = ['access-profiles'] as const;
const grantKey = (m: string, a: string) => `${m}:${a}`;

async function fetchProfiles(): Promise<AccessProfile[]> {
  const { data, error } = await supabase
    .from('role_templates')
    .select('id, role_name, label, description, is_system')
    .order('label');
  if (error) throw error;
  return data || [];
}

export function AccessProfilesManager() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [newProfileOpen, setNewProfileOpen] = useState(false);
  const [newProfile, setNewProfile] = useState({ role_name: '', label: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<AccessProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: profiles = [], isPending: loading } = useQuery({
    queryKey: PROFILES_QUERY_KEY,
    queryFn: fetchProfiles,
  });

  const selected = profiles.find(p => p.id === selectedId) || null;

  const loadGrantsAndCount = async (profileId: string) => {
    setLoadingGrants(true);
    try {
      const [{ data: grantRows }, { count }] = await Promise.all([
        supabase.from('module_permissions').select('module, action').eq('profile_id', profileId),
        supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }).eq('profile_id', profileId),
      ]);
      setGrants(new Set((grantRows || []).map(g => grantKey(g.module, g.action))));
      setUserCount(count ?? 0);
    } catch (error) {
      console.error('Erro ao carregar permissões do perfil:', error);
      toast.error('Erro ao carregar permissões do perfil');
    } finally {
      setLoadingGrants(false);
    }
  };

  const selectProfile = (p: AccessProfile) => {
    setSelectedId(p.id);
    loadGrantsAndCount(p.id);
  };

  // Toggle imediato — é exatamente o que torna o perfil "vivo": qualquer usuário
  // que já usa esse perfil recebe a mudança na hora, sem precisar ser reconfigurado.
  const toggleGrant = async (module: string, action: string) => {
    if (!selected) return;
    const key = grantKey(module, action);
    const has = grants.has(key);
    try {
      if (has) {
        const { error } = await supabase
          .from('module_permissions')
          .delete()
          .eq('profile_id', selected.id).eq('module', module).eq('action', action);
        if (error) throw error;
        setGrants(prev => { const next = new Set(prev); next.delete(key); return next; });
      } else {
        const { error } = await supabase
          .from('module_permissions')
          .insert({ profile_id: selected.id, module, action, scope: 'all' });
        if (error) throw error;
        setGrants(prev => new Set(prev).add(key));
      }
    } catch (error) {
      console.error('Erro ao atualizar permissão do perfil:', error);
      toast.error('Erro ao atualizar permissão do perfil');
    }
  };

  const createProfile = async () => {
    if (!newProfile.role_name.trim() || !newProfile.label.trim()) {
      toast.error('Nome interno e rótulo são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('role_templates')
        .insert({
          role_name: newProfile.role_name.trim().toLowerCase().replace(/\s+/g, '_'),
          label: newProfile.label.trim(),
          description: newProfile.description.trim() || null,
          is_system: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      toast.success('Perfil criado!');
      setNewProfileOpen(false);
      setNewProfile({ role_name: '', label: '', description: '' });
      await queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
      if (data?.id) selectProfile({ id: data.id, role_name: newProfile.role_name, label: newProfile.label, description: null, is_system: false });
    } catch (error: any) {
      console.error('Erro ao criar perfil:', error);
      toast.error(error?.message?.includes('duplicate') ? 'Já existe um perfil com esse nome interno' : 'Erro ao criar perfil');
    } finally {
      setCreating(false);
    }
  };

  const deleteProfile = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('role_templates').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Perfil excluído.');
      if (selectedId === deleteTarget.id) { setSelectedId(null); setGrants(new Set()); }
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
    } catch (error: any) {
      console.error('Erro ao excluir perfil:', error);
      if (error?.message?.includes('foreign key') || error?.code === '23503') {
        toast.error('Não é possível excluir: existem usuários usando este perfil. Troque o perfil deles primeiro.');
      } else {
        toast.error('Erro ao excluir perfil');
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Perfis de Acesso
            </CardTitle>
            <CardDescription>
              Cada perfil é um conjunto de permissões por módulo. Editar aqui atualiza, na hora, todo mundo que usa esse perfil.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setNewProfileOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Perfil
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          <div className="space-y-1">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => selectProfile(p)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedId === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                {p.label}
                {p.is_system && (
                  <Badge variant="outline" className={`ml-2 text-[10px] ${selectedId === p.id ? 'border-primary-foreground/40 text-primary-foreground' : ''}`}>
                    padrão
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div>
            {!selected ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Selecione um perfil pra ver ou editar as permissões.
              </div>
            ) : loadingGrants ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{selected.label}</h3>
                    {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" /> {userCount ?? 0} usuário(s) com este perfil
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir perfil
                  </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Módulo</th>
                        {ACCESS_ACTIONS.map(a => (
                          <th key={a.key} className="text-center p-2 font-medium">{a.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ACCESS_MODULES.map(m => (
                        <tr key={m.key} className="border-b last:border-0">
                          <td className="p-2">{m.label}</td>
                          {ACCESS_ACTIONS.map(a => (
                            <td key={a.key} className="text-center p-2">
                              <Checkbox
                                checked={grants.has(grantKey(m.key, a.key))}
                                onCheckedChange={() => toggleGrant(m.key, a.key)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={newProfileOpen} onOpenChange={setNewProfileOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Perfil de Acesso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome interno</Label>
              <Input
                value={newProfile.role_name}
                onChange={e => setNewProfile(prev => ({ ...prev, role_name: e.target.value }))}
                placeholder="ex.: expedicao"
              />
            </div>
            <div>
              <Label>Rótulo (exibido)</Label>
              <Input
                value={newProfile.label}
                onChange={e => setNewProfile(prev => ({ ...prev, label: e.target.value }))}
                placeholder="ex.: Expedição"
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newProfile.description}
                onChange={e => setNewProfile(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProfileOpen(false)}>Cancelar</Button>
            <Button onClick={createProfile} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil "{deleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se algum usuário ainda estiver usando este perfil, a exclusão será bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProfile} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

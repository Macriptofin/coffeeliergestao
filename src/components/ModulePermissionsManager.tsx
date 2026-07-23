import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, ChevronDown, ChevronRight, Save } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

interface RoleTemplate {
  role_name: string;
  label: string;
  description: string;
  permissions: { module: string; action: string }[];
}

interface PermMatrix {
  [module: string]: {
    [action: string]: boolean;
  };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODULES = [
  { key: 'materiais',    label: 'Materiais / Estoque' },
  { key: 'compras',      label: 'Compras' },
  { key: 'vendas',       label: 'Vendas / Propostas' },
  { key: 'producao',     label: 'Produção' },
  { key: 'agenda',       label: 'Agenda de Eventos' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'financeiro',   label: 'Financeiro' },
  { key: 'rh',           label: 'Recursos Humanos' },
  { key: 'config',       label: 'Configurações' },
];

const ACTIONS = [
  { key: 'view',    label: 'Visualizar' },
  { key: 'create',  label: 'Criar' },
  { key: 'edit',    label: 'Editar' },
  { key: 'delete',  label: 'Deletar' },
  { key: 'approve', label: 'Aprovar' },
];

const EMPTY_MATRIX = (): PermMatrix => {
  const m: PermMatrix = {};
  MODULES.forEach(mod => {
    m[mod.key] = {};
    ACTIONS.forEach(act => { m[mod.key][act.key] = false; });
  });
  return m;
};

const EMPTY_USERS: UserProfile[] = [];
const EMPTY_TEMPLATES: RoleTemplate[] = [];

async function fetchUsersAndTemplates(): Promise<{ users: UserProfile[]; templates: RoleTemplate[] }> {
  const [profilesRes, templatesRes, rolesRes] = await Promise.all([
    supabase.from('user_profiles').select('id, user_id, full_name, display_name, email'),
    supabase.from('role_templates').select('role_name, label, description, permissions'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const roleMap: Record<string, string> = {};
  rolesRes.data?.forEach((r: any) => { roleMap[r.user_id] = r.role; });

  const users: UserProfile[] = (profilesRes.data || []).map((p: any) => ({
    id:        p.user_id || p.id,
    email:     p.email || '—',
    full_name: p.full_name || p.display_name,
    role:      roleMap[p.user_id || p.id],
  }));

  const templates: RoleTemplate[] = (templatesRes.data || []).map((t: any) => ({
    ...t,
    permissions: typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions,
  }));

  return { users, templates };
}

async function fetchUserPermissionsMatrix(uid: string): Promise<PermMatrix> {
  const { data, error } = await supabase
    .from('module_permissions')
    .select('module, action')
    .eq('user_id', uid);
  if (error) throw error;

  const m = EMPTY_MATRIX();
  data?.forEach((p: any) => {
    if (m[p.module]) m[p.module][p.action] = true;
  });
  return m;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ModulePermissionsManager() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [matrix,     setMatrix]     = useState<PermMatrix>(EMPTY_MATRIX());
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});

  const { data: baseData, isPending: loading } = useQuery({
    queryKey: ['users-and-role-templates'],
    queryFn: fetchUsersAndTemplates,
  });
  const users = baseData?.users ?? EMPTY_USERS;
  const templates = baseData?.templates ?? EMPTY_TEMPLATES;

  const permissionsQueryKey = ['module-permissions', selectedUser];
  const { data: fetchedMatrix } = useQuery({
    queryKey: permissionsQueryKey,
    queryFn: () => fetchUserPermissionsMatrix(selectedUser),
    enabled: !!selectedUser,
  });

  // matrix precisa ser editável localmente (checkboxes antes de salvar) —
  // ressincroniza a partir do servidor sempre que o usuário selecionado muda.
  useEffect(() => {
    setMatrix(selectedUser && fetchedMatrix ? fetchedMatrix : EMPTY_MATRIX());
  }, [selectedUser, fetchedMatrix]);

  const applyTemplate = (roleName: string) => {
    const tpl = templates.find(t => t.role_name === roleName);
    if (!tpl) return;
    const m = EMPTY_MATRIX();
    tpl.permissions.forEach(p => {
      if (m[p.module]) m[p.module][p.action] = true;
    });
    setMatrix(m);
    toast.info(`Perfil "${tpl.label}" aplicado. Salve para confirmar.`);
  };

  const toggle = (module: string, action: string) => {
    setMatrix(prev => ({
      ...prev,
      [module]: { ...prev[module], [action]: !prev[module][action] },
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);

      // Apagar permissões atuais
      await supabase.from('module_permissions').delete().eq('user_id', selectedUser);

      // Inserir novas
      const rows: any[] = [];
      Object.entries(matrix).forEach(([mod, actions]) => {
        Object.entries(actions).forEach(([act, enabled]) => {
          if (enabled) rows.push({ user_id: selectedUser, module: mod, action: act });
        });
      });

      if (rows.length) {
        const { error } = await supabase.from('module_permissions').insert(rows);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: permissionsQueryKey });
      toast.success(`Permissões salvas — ${rows.length} permissões ativas`);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedUserObj = users.find(u => u.id === selectedUser);
  const isAdminUser = selectedUserObj?.role === 'admin' || selectedUserObj?.role === 'manager';

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões por Módulo
        </CardTitle>
        <CardDescription>
          Configure quais módulos e ações cada usuário pode acessar. Admins e gestores têm acesso total automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Seleção de usuário */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Usuário</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                    {u.role && <span className="text-muted-foreground ml-2">({u.role})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && !isAdminUser && (
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Aplicar perfil</label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um perfil..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.role_name} value={t.role_name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Aviso admin */}
        {isAdminUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Este usuário tem papel de <strong>{selectedUserObj?.role}</strong> e já possui acesso total ao sistema. Permissões granulares não se aplicam.
          </div>
        )}

        {/* Matriz de permissões */}
        {selectedUser && !isAdminUser && (
          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-2 px-3 py-2 bg-muted rounded-lg text-xs font-semibold text-muted-foreground">
              <span className="col-span-1">Módulo</span>
              {ACTIONS.map(a => <span key={a.key} className="text-center">{a.label}</span>)}
            </div>

            {MODULES.map(mod => (
              <div key={mod.key} className="grid grid-cols-6 gap-2 px-3 py-2.5 border rounded-lg items-center hover:bg-accent/30 transition-colors">
                <span className="text-sm font-medium col-span-1">{mod.label}</span>
                {ACTIONS.map(act => (
                  <div key={act.key} className="flex justify-center">
                    <Checkbox
                      checked={matrix[mod.key]?.[act.key] ?? false}
                      onCheckedChange={() => toggle(mod.key, act.key)}
                    />
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                {Object.values(matrix).flatMap(m => Object.values(m)).filter(Boolean).length} permissões ativas
              </span>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Permissões
              </Button>
            </div>
          </div>
        )}

        {!selectedUser && (
          <p className="text-muted-foreground text-sm text-center py-6">
            Selecione um usuário para configurar suas permissões.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

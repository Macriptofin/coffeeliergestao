import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ArrowLeft, User, Shield, KeyRound, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { ACCESS_MODULES, ACCESS_ACTIONS } from "@/lib/accessModules";

interface UserWithProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  created_at: string;
  email_confirmed?: boolean;
  roles: Array<{
    id: string;
    role: 'admin' | 'manager' | 'financial' | 'user';
    created_at: string;
  }>;
}

interface AccessProfile {
  id: string;
  role_name: string;
  label: string;
}

interface UserEditorProps {
  user: UserWithProfile;
  onClose: () => void;
  onUserUpdated: () => void;
}

export function UserEditor({ user, onClose, onUserUpdated }: UserEditorProps) {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [profileData, setProfileData] = useState({
    full_name: user.full_name || '',
    display_name: user.display_name || ''
  });
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'financial' | 'user'>(
    user.roles[0]?.role || 'user'
  );

  // Perfil de Acesso (role_templates) — só se aplica quando selectedRole === 'user'.
  // 'admin' fica fora da lista: role='admin' já dá bypass total via nível de acesso,
  // não faz sentido também "ser perfil admin" (confundiria os dois conceitos).
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileGrants, setProfileGrants] = useState<Set<string>>(new Set());
  const [exceptionGrants, setExceptionGrants] = useState<Set<string>>(new Set());
  const [loadingAccess, setLoadingAccess] = useState(true);

  const grantKey = (m: string, a: string) => `${m}:${a}`;

  const loadAccessData = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const [{ data: profiles }, { data: userProfileRow }, { data: exceptions }] = await Promise.all([
        supabase.from('role_templates').select('id, role_name, label').order('label'),
        supabase.from('user_profiles').select('profile_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('module_permissions').select('module, action').eq('user_id', user.id),
      ]);

      setAccessProfiles((profiles || []).filter(p => p.role_name !== 'admin'));
      setSelectedProfileId(userProfileRow?.profile_id ?? null);
      setExceptionGrants(new Set((exceptions || []).map(e => grantKey(e.module, e.action))));
    } catch (error) {
      console.error('Erro ao carregar dados de acesso:', error);
      toast.error('Erro ao carregar dados de acesso');
    } finally {
      setLoadingAccess(false);
    }
  }, [user.id]);

  useEffect(() => { loadAccessData(); }, [loadAccessData]);

  // Carrega as permissões do perfil selecionado (só leitura aqui — editar o perfil
  // em si é feito na tela "Perfis de Acesso", e propaga pra todo mundo que o usa).
  useEffect(() => {
    if (!selectedProfileId) { setProfileGrants(new Set()); return; }
    supabase.from('module_permissions').select('module, action').eq('profile_id', selectedProfileId)
      .then(({ data }) => setProfileGrants(new Set((data || []).map(g => grantKey(g.module, g.action)))));
  }, [selectedProfileId]);

  const saveProfile = async () => {
    try {
      setLoading(true);

      // Salvar ou atualizar perfil - especificando onConflict
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: profileData.full_name || null,
          display_name: profileData.display_name || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      toast.success('Perfil atualizado com sucesso!');
      onUserUpdated();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const saveAccess = async () => {
    try {
      setLoading(true);

      // Nível de acesso (user_roles) — mesma lógica de sempre (1 role por usuário).
      await supabase.from('user_roles').delete().eq('user_id', user.id);
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: selectedRole });
      if (roleError) throw roleError;

      // Perfil de Acesso — só vale quando o nível é "user"; admin/manager não usam.
      const { error: profileLinkError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          profile_id: selectedRole === 'user' ? selectedProfileId : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (profileLinkError) throw profileLinkError;

      toast.success('Acesso atualizado com sucesso!');
      onUserUpdated();
    } catch (error) {
      console.error('Erro ao atualizar acesso:', error);
      toast.error('Erro ao atualizar acesso');
    } finally {
      setLoading(false);
    }
  };

  // Exceção pontual: concede (ou remove) uma ação específica pra ESTE usuário, por
  // cima do que o perfil dele já dá. Grava direto (sem botão de salvar à parte),
  // mesmo padrão que a tela de Perfis de Acesso usa pro perfil em si.
  const toggleException = async (module: string, action: string) => {
    const key = grantKey(module, action);
    const has = exceptionGrants.has(key);
    try {
      if (has) {
        const { error } = await supabase
          .from('module_permissions')
          .delete()
          .eq('user_id', user.id).eq('module', module).eq('action', action);
        if (error) throw error;
        setExceptionGrants(prev => { const next = new Set(prev); next.delete(key); return next; });
      } else {
        const { error } = await supabase
          .from('module_permissions')
          .insert({ user_id: user.id, module, action, scope: 'all' });
        if (error) throw error;
        setExceptionGrants(prev => new Set(prev).add(key));
      }
    } catch (error) {
      console.error('Erro ao atualizar exceção:', error);
      toast.error('Erro ao atualizar exceção de permissão');
    }
  };

  const setUserPassword = async () => {
    // Validação de senha forte
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!newPassword) {
      toast.error('Digite uma senha');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (!passwordRegex.test(newPassword)) {
      toast.error('A senha deve conter: maiúscula, minúscula, número e caractere especial (@$!%*?&)');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.functions.invoke('admin-set-password', {
        body: {
          user_id: user.id,
          password: newPassword
        }
      });

      if (error) {
        toast.error(`Erro ao definir senha: ${error.message}`);
      } else {
        toast.success('Senha definida com sucesso!');
        setNewPassword('');
      }
    } catch (error) {
      console.error('Erro ao definir senha:', error);
      toast.error('Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  };

  // E-mail com a marca Coffeelier + link seguro pra pessoa definir a própria senha —
  // substitui ter que repassar a senha por fora (WhatsApp etc), já que a criação de
  // usuário e o "Definir Nova Senha" abaixo não mandam nenhum e-mail sozinhos.
  const sendAccessEmail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('send-user-access-email', {
        body: { user_id: user.id },
      });
      if (error) {
        toast.error(`Erro ao enviar e-mail de acesso: ${error.message}`);
      } else if (!data?.success) {
        toast.error(data?.error || 'Erro ao enviar e-mail de acesso');
      } else {
        toast.success(`E-mail de acesso enviado para ${user.email}`);
      }
    } catch (error) {
      console.error('Erro ao enviar e-mail de acesso:', error);
      toast.error('Erro ao enviar e-mail de acesso');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailVerification = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) {
        toast.error(`Erro ao reenviar verificação: ${error.message}`);
      } else {
        toast.success(`Email de verificação reenviado para ${user.email}`);
      }
    } catch (error) {
      console.error('Erro ao reenviar verificação:', error);
      toast.error('Erro ao reenviar email de verificação');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'financial': return 'secondary';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  const getUserDisplayName = () => {
    return profileData.display_name || profileData.full_name || user.email;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Editar Usuário
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {getUserDisplayName()} • {user.email}
                  {user.email_confirmed ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-xs">Verificado</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs">Não verificado</span>
                    </div>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.roles.map(role => (
                <Badge key={role.id} variant={getRoleBadgeVariant(role.role)}>
                  {role.role}
                </Badge>
              ))}
              {user.roles.length === 0 && (
                <Badge variant="outline">Sem role</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="access">Acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Configure as informações básicas do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    O email não pode ser alterado
                  </p>
                </div>
                <div>
                  <Label htmlFor="userId">ID do Usuário</Label>
                  <Input
                    id="userId"
                    value={user.id}
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Nome completo do usuário"
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Nome de Exibição</Label>
                  <Input
                    id="displayName"
                    value={profileData.display_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Nome que aparece no sistema"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Definir Nova Senha
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      type="password"
                      placeholder="Nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Requisitos: mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial (@$!%*?&)
                    </p>
                  </div>
                  <Button
                    onClick={setUserPassword}
                    disabled={loading || !newPassword}
                  >
                    Definir Senha
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O usuário poderá alterar esta senha após o primeiro login.
                </p>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                <p><strong>Criado em:</strong> {new Date(user.created_at).toLocaleString('pt-BR')}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={sendAccessEmail}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Enviar E-mail de Acesso
                </Button>
                {!user.email_confirmed && (
                  <Button
                    variant="outline"
                    onClick={sendEmailVerification}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Reenviar Verificação
                  </Button>
                )}
                <Button onClick={saveProfile} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Acesso
              </CardTitle>
              <CardDescription>
                Nível de acesso e Perfil de Acesso do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="userRole">Nível de Acesso</Label>
                <Select value={selectedRole} onValueChange={(value: 'admin' | 'manager' | 'user') => setSelectedRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Acesso total ao sistema</SelectItem>
                    <SelectItem value="manager">Gestor - Acesso total, exceto área de segurança</SelectItem>
                    <SelectItem value="user">Usuário - Acesso conforme Perfil de Acesso</SelectItem>
                  </SelectContent>
                </Select>
                {selectedRole === 'financial' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nível "Financial" está descontinuado — escolha "Usuário" + perfil "Financeiro" abaixo.
                  </p>
                )}
              </div>

              {selectedRole === 'user' ? (
                <>
                  <div>
                    <Label htmlFor="accessProfile">Perfil de Acesso</Label>
                    <Select
                      value={selectedProfileId ?? '__none__'}
                      onValueChange={(v) => setSelectedProfileId(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem perfil (nenhum acesso além do básico)</SelectItem>
                        {accessProfiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Editar o perfil em si (não este usuário) é feito em Configurações → Perfis de Acesso, e vale pra todo mundo que usa aquele perfil.
                    </p>
                  </div>

                  {!loadingAccess && (
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
                              {ACCESS_ACTIONS.map(a => {
                                const key = grantKey(m.key, a.key);
                                const fromProfile = profileGrants.has(key);
                                const isException = exceptionGrants.has(key);
                                return (
                                  <td key={a.key} className="text-center p-2">
                                    <Checkbox
                                      checked={fromProfile || isException}
                                      disabled={fromProfile}
                                      onCheckedChange={() => toggleException(m.key, a.key)}
                                      title={fromProfile ? 'Concedido pelo perfil' : 'Exceção pontual deste usuário'}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Caixas travadas vêm do perfil selecionado. Marque uma caixa extra pra dar uma exceção pontual só pra este usuário, por cima do perfil.
                  </p>
                </>
              ) : (
                <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
                  {selectedRole === 'admin' ? 'Admin' : 'Gestor'} tem acesso total ao sistema — Perfil de Acesso não se aplica.
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={saveAccess} disabled={loading}>
                  <Shield className="h-4 w-4 mr-2" />
                  Salvar Acesso
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

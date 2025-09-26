import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Mail, ArrowLeft } from "lucide-react";

interface UserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [sendPasswordReset, setSendPasswordReset] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    displayName: '',
    role: 'user' as 'admin' | 'manager' | 'financial' | 'user',
    tempPassword: generateRandomPassword()
  });

  function generateRandomPassword() {
    return Math.random().toString(36).slice(-8) + 'A1!';
  }

  const createUser = async () => {
    if (!formData.email || !formData.fullName) {
      toast.error('Email e Nome Completo são obrigatórios');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    try {
      setLoading(true);

      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.tempPassword,
      });

      if (error) {
        if (error.message?.includes('User already registered')) {
          toast.error('Este email já está cadastrado no sistema');
        } else {
          toast.error(`Erro ao criar usuário: ${error.message}`);
        }
        return;
      }

      if (!data.user) {
        toast.error('Erro ao criar usuário');
        return;
      }

      const userId = data.user.id;

      // Create user profile - o e-mail será sincronizado automaticamente pelo trigger
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          full_name: formData.fullName,
          display_name: formData.displayName || formData.fullName,
          email: formData.email // Garantir que o e-mail está correto
        });

      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        toast.error('Usuário criado, mas erro ao salvar perfil');
      }

      // Create user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: formData.role
        });

      if (roleError) {
        console.error('Erro ao criar role:', roleError);
        toast.error('Usuário criado, mas erro ao definir role');
      }

      // Send password reset email if requested
      if (sendPasswordReset) {
        try {
          const { error } = await supabase.functions.invoke('password-reset', {
            body: {
              email: formData.email,
              redirectTo: `${window.location.origin}/auth`
            }
          });

          if (error) {
            console.warn('Erro ao enviar email de configuração de senha:', error);
          }
        } catch (error) {
          console.warn('Erro ao enviar email de configuração:', error);
        }
      }

      toast.success(`Usuário ${formData.fullName} criado com sucesso!`);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro inesperado ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Criar Novo Usuário
              </CardTitle>
              <CardDescription>
                Preencha as informações para criar um novo usuário no sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@exemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Nome completo do usuário"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome de Exibição</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Nome que aparece no sistema"
                />
                <p className="text-xs text-muted-foreground">
                  Se não informado, será usado o nome completo
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role do Sistema</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'admin' | 'manager' | 'financial' | 'user') => 
                    setFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Acesso total</SelectItem>
                    <SelectItem value="manager">Manager - Gestão operacional</SelectItem>
                    <SelectItem value="financial">Financial - Gestão financeira</SelectItem>
                    <SelectItem value="user">User - Acesso básico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Configuração de Senha */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configuração de Acesso</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendPasswordReset"
                checked={sendPasswordReset}
                onCheckedChange={(checked) => setSendPasswordReset(checked as boolean)}
              />
              <Label htmlFor="sendPasswordReset" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Enviar email de configuração de senha
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Se marcado, o usuário receberá um email para definir sua própria senha. 
              Caso contrário, uma senha temporária será gerada automaticamente.
            </p>
          </div>

          <Separator />

          {/* Permissões Detalhadas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Permissões Específicas</h3>
            <p className="text-sm text-muted-foreground">
              Após criar o usuário, você poderá configurar as permissões detalhadas através da opção "Editar" na lista de usuários.
            </p>
            <div className="p-4 border border-dashed border-muted-foreground/25 rounded-lg text-center text-muted-foreground">
              As permissões detalhadas serão configuradas após a criação do usuário
            </div>
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={createUser} disabled={loading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
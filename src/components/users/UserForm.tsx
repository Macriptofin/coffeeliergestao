import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, ArrowLeft, Mail, Shield, Info } from "lucide-react";

interface UserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    displayName: '',
    role: 'user' as 'admin' | 'manager' | 'financial' | 'user',
    password: ''
  });

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

    // Validação de senha forte
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!formData.password) {
      toast.error('A senha é obrigatória');
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    
    if (!passwordRegex.test(formData.password)) {
      toast.error('A senha deve conter: maiúscula, minúscula, número e caractere especial (@$!%*?&)');
      return;
    }

    try {
      setLoading(true);

      // Criar usuário diretamente com senha definida pelo admin
      const { data, error } = await supabase.functions.invoke('create-user-with-invite', {
        body: {
          email: formData.email,
          role: formData.role,
          full_name: formData.fullName,
          display_name: formData.displayName || formData.fullName,
          password: formData.password
        }
      });

      if (error) {
        console.error('Erro ao enviar convite:', error);
        if (error.message?.includes('User already registered') || error.message?.includes('already exists')) {
          toast.error('Este email já está cadastrado no sistema');
        } else {
          toast.error(`Erro ao enviar convite: ${error.message}`);
        }
        return;
      }

      if (!data?.success) {
        toast.error('Erro ao enviar convite');
        return;
      }

      toast.success(
        `Usuário criado com sucesso! Email: ${formData.email}`,
        { duration: 5000 }
      );
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
          {/* Alert informativo sobre senha */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Você está definindo a senha inicial do usuário como administrador. O usuário poderá alterá-la após o primeiro login.
            </AlertDescription>
          </Alert>

          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informações Básicas
            </h3>
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
                <Label htmlFor="password">Senha Inicial *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Ex: Senha@123"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Requisitos: mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial (@$!%*?&)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Nível de Acesso
                </Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'admin' | 'manager' | 'financial' | 'user') => 
                    setFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível de acesso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Admin</span>
                        <span className="text-xs text-muted-foreground">Acesso total ao sistema</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Manager</span>
                        <span className="text-xs text-muted-foreground">Gestão operacional e equipes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="financial">
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Financial</span>
                        <span className="text-xs text-muted-foreground">Gestão financeira e relatórios</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">User</span>
                        <span className="text-xs text-muted-foreground">Acesso básico ao sistema</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O nível de acesso define as permissões gerais do usuário no sistema
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Permissões Detalhadas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões Específicas
            </h3>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Após o usuário aceitar o convite, você poderá configurar permissões detalhadas através da opção "Editar" na lista de usuários.
              </AlertDescription>
            </Alert>
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
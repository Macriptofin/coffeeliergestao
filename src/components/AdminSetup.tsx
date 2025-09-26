import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";

export function AdminSetup() {
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkSetupStatus();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const checkSetupStatus = async () => {
    try {
      setCheckingSetup(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao verificar setup:', error);
        return;
      }

      setIsSetup(data && data.length > 0);
    } catch (error) {
      console.error('Erro ao verificar setup:', error);
    } finally {
      setCheckingSetup(false);
    }
  };

  const createFirstAdmin = async () => {
    if (!currentUser) {
      toast.error('Você precisa estar logado para se tornar admin');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: currentUser.id,
          role: 'admin'
        });

      if (error) throw error;

      toast.success('Você foi configurado como administrador do sistema!');
      setIsSetup(true);
      
      // Recarregar a página para atualizar as permissões
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Erro ao criar admin:', error);
      toast.error('Erro ao criar administrador. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isSetup) {
    return null; // Não mostrar nada quando o sistema já está configurado
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Shield className="h-5 w-5" />
          Configuração Inicial Necessária
        </CardTitle>
        <CardDescription className="text-amber-700">
          Sistema de segurança ativado - Configure o primeiro administrador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-300 bg-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Segurança Aprimorada:</strong> O acesso aos dados de fornecedores agora está restrito a usuários com permissões adequadas (Admin/Manager) para proteger informações sensíveis como CNPJ, contatos e endereços.
          </AlertDescription>
        </Alert>

        {currentUser ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              <strong>Usuário atual:</strong> {currentUser.email}
            </p>
            <p className="text-sm text-amber-600">
              Clique no botão abaixo para se tornar o primeiro administrador do sistema. Isso permitirá que você:
            </p>
            <ul className="text-sm text-amber-600 list-disc list-inside space-y-1">
              <li>Acesse e gerencie dados de fornecedores</li>
              <li>Gerencie permissões de outros usuários</li>
              <li>Tenha acesso completo ao sistema</li>
            </ul>
            <Button 
              onClick={createFirstAdmin} 
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {loading ? 'Configurando...' : 'Configurar como Administrador'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              Você precisa estar logado para configurar o sistema. Faça login primeiro.
            </p>
            <Button 
              onClick={() => window.location.href = '/auth'}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              Fazer Login
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
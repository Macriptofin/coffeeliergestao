import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Building2, FileText, Package } from "lucide-react";
import { CoffeelierLogo } from "@/components/CoffeelierLogo";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Authentication check and setup
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setAuthLoading(false);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Loading screen during authentication check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CoffeelierLogo />
          <p className="text-muted-foreground mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  // Authentication guard
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary-light/5">
      <div>
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <CoffeelierLogo />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">Coffeelier</h1>
          <p className="text-muted-foreground">Sistema de Gestão para Confeitarias</p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-center mb-6">Categorias Master</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/estoque')}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-blue-500 text-white rounded-lg w-fit mb-2">
                  <Package className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">Estoque</CardTitle>
                <CardDescription>Materiais, controle e movimentações</CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producao')}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-red-500 text-white rounded-lg w-fit mb-2">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">Produção</CardTitle>
                <CardDescription>Receitas, ordens e planejamento</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/fornecedores')}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-green-500 text-white rounded-lg w-fit mb-2">
                  <Building2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">Fornecedores</CardTitle>
                <CardDescription>Gestão completa de parceiros</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/relatorios')}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-purple-500 text-white rounded-lg w-fit mb-2">
                  <FileText className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">Relatórios</CardTitle>
                <CardDescription>Análises e indicadores</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground">
            Bem-vindo ao sistema integrado de gestão. Escolha uma categoria para começar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
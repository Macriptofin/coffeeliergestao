import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Shield, ShoppingCart, Package, Calendar, Users, DollarSign, FileText, Settings } from "lucide-react";

interface Permission {
  category: string;
  subcategory: string;
  id?: string;
  granted?: boolean;
}

interface PermissionsSelectorProps {
  userId: string;
  onPermissionsChange?: (permissions: Permission[]) => void;
}

const PERMISSION_CATEGORIES = {
  estoque: {
    name: 'Estoque',
    icon: Package,
    subcategories: [
      { key: 'estoque_visualizar', name: 'Visualizar Estoque' },
      { key: 'estoque_criar', name: 'Criar Itens' },
      { key: 'estoque_editar', name: 'Editar Itens' },
      { key: 'estoque_excluir', name: 'Excluir Itens' },
      { key: 'estoque_movimentacoes', name: 'Movimentações' },
    ]
  },
  compras: {
    name: 'Compras',
    icon: ShoppingCart,
    subcategories: [
      { key: 'compras_visualizar', name: 'Visualizar Compras' },
      { key: 'compras_criar', name: 'Criar Pedidos' },
      { key: 'compras_editar', name: 'Editar Pedidos' },
      { key: 'compras_excluir', name: 'Excluir Pedidos' },
      { key: 'compras_aprovar', name: 'Aprovar Compras' },
    ]
  },
  vendas: {
    name: 'Vendas',
    icon: DollarSign,
    subcategories: [
      { key: 'vendas_visualizar', name: 'Visualizar Vendas' },
      { key: 'vendas_criar', name: 'Criar Propostas' },
      { key: 'vendas_editar', name: 'Editar Propostas' },
      { key: 'vendas_excluir', name: 'Excluir Propostas' },
      { key: 'vendas_propostas', name: 'Gerenciar Propostas' },
      { key: 'vendas_clientes', name: 'Gerenciar Clientes' },
    ]
  },
  agenda: {
    name: 'Agenda',
    icon: Calendar,
    subcategories: [
      { key: 'agenda_visualizar', name: 'Visualizar Eventos' },
      { key: 'agenda_criar', name: 'Criar Eventos' },
      { key: 'agenda_editar', name: 'Editar Eventos' },
      { key: 'agenda_excluir', name: 'Excluir Eventos' },
      { key: 'agenda_eventos', name: 'Gerenciar Agenda' },
    ]
  },
  producao: {
    name: 'Produção',
    icon: Settings,
    subcategories: [
      { key: 'producao_visualizar', name: 'Visualizar Produção' },
      { key: 'producao_criar', name: 'Criar Receitas' },
      { key: 'producao_editar', name: 'Editar Receitas' },
      { key: 'producao_excluir', name: 'Excluir Receitas' },
      { key: 'producao_receitas', name: 'Gerenciar Receitas' },
      { key: 'producao_materiais', name: 'Gerenciar Materiais' },
    ]
  },
  fornecedores: {
    name: 'Fornecedores',
    icon: Users,
    subcategories: [
      { key: 'fornecedores_visualizar', name: 'Visualizar Fornecedores' },
      { key: 'fornecedores_criar', name: 'Criar Fornecedores' },
      { key: 'fornecedores_editar', name: 'Editar Fornecedores' },
      { key: 'fornecedores_excluir', name: 'Excluir Fornecedores' },
      { key: 'fornecedores_produtos', name: 'Produtos de Fornecedores' },
    ]
  },
  financeiro: {
    name: 'Financeiro',
    icon: DollarSign,
    subcategories: [
      { key: 'financeiro_visualizar', name: 'Visualizar Financeiro' },
      { key: 'financeiro_contas_pagar', name: 'Contas a Pagar' },
      { key: 'financeiro_contas_receber', name: 'Contas a Receber' },
      { key: 'financeiro_fluxo_caixa', name: 'Fluxo de Caixa' },
      { key: 'financeiro_relatorios', name: 'Relatórios Financeiros' },
    ]
  },
  relatorios: {
    name: 'Relatórios',
    icon: FileText,
    subcategories: [
      { key: 'relatorios_visualizar', name: 'Visualizar Relatórios' },
      { key: 'relatorios_financeiros', name: 'Relatórios Financeiros' },
      { key: 'relatorios_operacionais', name: 'Relatórios Operacionais' },
      { key: 'relatorios_exportar', name: 'Exportar Relatórios' },
    ]
  },
  usuarios: {
    name: 'Usuários',
    icon: Shield,
    subcategories: [
      { key: 'usuarios_visualizar', name: 'Visualizar Usuários' },
      { key: 'usuarios_criar', name: 'Criar Usuários' },
      { key: 'usuarios_editar', name: 'Editar Usuários' },
      { key: 'usuarios_excluir', name: 'Excluir Usuários' },
      { key: 'usuarios_permissoes', name: 'Gerenciar Permissões' },
    ]
  },
};

const EMPTY_PERMISSIONS: Permission[] = [];

async function fetchUserPermissions(userId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return data?.map(p => ({
    category: p.category,
    subcategory: p.subcategory,
    id: p.id,
    granted: true
  })) || [];
}

export function PermissionsSelector({ userId, onPermissionsChange }: PermissionsSelectorProps) {
  const queryClient = useQueryClient();
  const permissionsQueryKey = ['user-permissions', userId];
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const { data: permissions = EMPTY_PERMISSIONS, isError } = useQuery({
    queryKey: permissionsQueryKey,
    queryFn: () => fetchUserPermissions(userId),
  });

  useEffect(() => {
    if (isError) toast.error('Erro ao carregar permissões do usuário');
  }, [isError]);

  useEffect(() => {
    onPermissionsChange?.(permissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions]);

  const reload = () => queryClient.invalidateQueries({ queryKey: permissionsQueryKey });

  const hasPermission = (category: string, subcategory: string) => {
    return permissions.some(p => p.category === category && p.subcategory === subcategory && p.granted);
  };

  const hasCategoryPermissions = (category: string) => {
    const categoryConfig = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES];
    return categoryConfig.subcategories.some(sub => hasPermission(category, sub.key));
  };

  const toggleCategoryExpanded = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleCategoryPermissions = async (category: string, grant: boolean) => {
    try {
      setLoading(true);
      const categoryConfig = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES];
      
      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      if (grant) {
        // Conceder todas as permissões da categoria
        const permissionsToInsert = categoryConfig.subcategories.map(sub => ({
          user_id: userId,
          category: category as any,
          subcategory: sub.key as any,
          granted_by: user?.id
        }));

        const { error } = await supabase
          .from('user_permissions')
          .upsert(permissionsToInsert, { onConflict: 'user_id,category,subcategory' });

        if (error) throw error;
      } else {
        // Remover todas as permissões da categoria
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('category', category as any);

        if (error) throw error;
      }

      await reload();
      toast.success(`Permissões da categoria ${categoryConfig.name} ${grant ? 'concedidas' : 'removidas'}`);
    } catch (error) {
      console.error('Erro ao alterar permissões da categoria:', error);
      toast.error('Erro ao alterar permissões');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubcategoryPermission = async (category: string, subcategory: string, grant: boolean) => {
    try {
      setLoading(true);
      
      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      if (grant) {
        const { error } = await supabase
          .from('user_permissions')
          .upsert({
            user_id: userId,
            category: category as any,
            subcategory: subcategory as any,
            granted_by: user?.id
          }, { onConflict: 'user_id,category,subcategory' });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('category', category as any)
          .eq('subcategory', subcategory as any);

        if (error) throw error;
      }

      await reload();
    } catch (error) {
      console.error('Erro ao alterar permissão:', error);
      toast.error('Erro ao alterar permissão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões Detalhadas
        </CardTitle>
        <CardDescription>
          Configure as permissões específicas por módulo do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, categoryConfig]) => {
            const Icon = categoryConfig.icon;
            const hasAnyPermissions = hasCategoryPermissions(categoryKey);
            const allPermissionsGranted = categoryConfig.subcategories.every(sub => 
              hasPermission(categoryKey, sub.key)
            );

            return (
              <div key={categoryKey} className="border rounded-lg">
                <Collapsible
                  open={expandedCategories.has(categoryKey)}
                  onOpenChange={() => toggleCategoryExpanded(categoryKey)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {expandedCategories.has(categoryKey) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{categoryConfig.name}</span>
                        <Checkbox
                          checked={allPermissionsGranted}
                          onCheckedChange={(checked) => 
                            toggleCategoryPermissions(categoryKey, checked as boolean)
                          }
                          disabled={loading}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {hasAnyPermissions && (
                      <div className="text-sm text-muted-foreground">
                        {categoryConfig.subcategories.filter(sub => 
                          hasPermission(categoryKey, sub.key)
                        ).length}/{categoryConfig.subcategories.length} ativas
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3">
                    <div className="pl-8 space-y-2 border-l-2 border-muted ml-2">
                      {categoryConfig.subcategories.map(subcategory => (
                        <div key={subcategory.key} className="flex items-center justify-between py-1">
                          <span className="text-sm">{subcategory.name}</span>
                          <Checkbox
                            checked={hasPermission(categoryKey, subcategory.key)}
                            onCheckedChange={(checked) => 
                              toggleSubcategoryPermission(categoryKey, subcategory.key, checked as boolean)
                            }
                            disabled={loading}
                          />
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
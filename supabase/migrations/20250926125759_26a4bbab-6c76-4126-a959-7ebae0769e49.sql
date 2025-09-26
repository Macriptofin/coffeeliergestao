-- Criar tabela para perfis de usuários
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para user_profiles
CREATE POLICY "Users can view their own profile and admins can view all"
ON public.user_profiles FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile and admins can update all"
ON public.user_profiles FOR UPDATE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user profiles"
ON public.user_profiles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Criar enum para categorias de permissão
CREATE TYPE permission_category AS ENUM (
  'estoque',
  'compras', 
  'vendas',
  'agenda',
  'producao',
  'fornecedores',
  'financeiro',
  'relatorios',
  'usuarios'
);

-- Criar enum para subcategorias de permissão
CREATE TYPE permission_subcategory AS ENUM (
  -- Estoque
  'estoque_visualizar',
  'estoque_criar',
  'estoque_editar',
  'estoque_excluir',
  'estoque_movimentacoes',
  
  -- Compras
  'compras_visualizar',
  'compras_criar',
  'compras_editar',
  'compras_excluir',
  'compras_aprovar',
  
  -- Vendas
  'vendas_visualizar',
  'vendas_criar',
  'vendas_editar',
  'vendas_excluir',
  'vendas_propostas',
  'vendas_clientes',
  
  -- Agenda
  'agenda_visualizar',
  'agenda_criar',
  'agenda_editar',
  'agenda_excluir',
  'agenda_eventos',
  
  -- Producao
  'producao_visualizar',
  'producao_criar',
  'producao_editar',
  'producao_excluir',
  'producao_receitas',
  'producao_materiais',
  
  -- Fornecedores
  'fornecedores_visualizar',
  'fornecedores_criar',
  'fornecedores_editar',
  'fornecedores_excluir',
  'fornecedores_produtos',
  
  -- Financeiro
  'financeiro_visualizar',
  'financeiro_contas_pagar',
  'financeiro_contas_receber',
  'financeiro_fluxo_caixa',
  'financeiro_relatorios',
  
  -- Relatórios
  'relatorios_visualizar',
  'relatorios_financeiros',
  'relatorios_operacionais',
  'relatorios_exportar',
  
  -- Usuários
  'usuarios_visualizar',
  'usuarios_criar',
  'usuarios_editar',
  'usuarios_excluir',
  'usuarios_permissoes'
);

-- Criar tabela de permissões detalhadas do usuário
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category permission_category NOT NULL,
  subcategory permission_subcategory NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, subcategory)
);

-- Habilitar RLS para user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at em user_profiles
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar permissões específicas
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_category permission_category, p_subcategory permission_subcategory DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = p_user_id
      AND up.category = p_category
      AND (p_subcategory IS NULL OR up.subcategory = p_subcategory)
  ) OR has_role(p_user_id, 'admin');
$$;
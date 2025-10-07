-- ============================================================================
-- ETAPA 1: Correção de Segurança - vw_cost_audit
-- ============================================================================
-- Problema: A view vw_cost_audit estava acessando auth.users diretamente,
-- causando vulnerabilidade de segurança.
-- Solução: Criar função SECURITY DEFINER para acessar auth.users com segurança.

-- Função segura para obter email do usuário
CREATE OR REPLACE FUNCTION public.get_user_email_safe(p_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::TEXT 
  FROM auth.users 
  WHERE id = p_user_id;
$$;

-- Recriar view vw_cost_audit usando a função segura
DROP VIEW IF EXISTS public.vw_cost_audit;

CREATE VIEW public.vw_cost_audit AS
SELECT 
  m.id AS material_id,
  m.code AS material_code,
  m.name AS material_name,
  m.category,
  m.subcategory,
  
  -- Informações de custo do stock_items
  si.average_price,
  si.cost_source,
  si.cost_last_updated_at,
  public.get_user_email_safe(si.cost_last_updated_by) AS cost_last_updated_by_email,
  si.manual_price,
  
  -- Dados fiscais
  m.ncm,
  m.cfop_padrao,
  m.cst_csosn,
  m.origem,
  
  -- Última movimentação
  (
    SELECT sm.created_at 
    FROM stock_movements sm 
    WHERE sm.material_id = m.id 
    ORDER BY sm.created_at DESC 
    LIMIT 1
  ) AS last_movement_at,
  
  (
    SELECT sm.movement_type 
    FROM stock_movements sm 
    WHERE sm.material_id = m.id 
    ORDER BY sm.created_at DESC 
    LIMIT 1
  ) AS last_movement_type,
  
  -- Estoque atual
  si.current_quantity,
  si.total_value,
  
  -- Timestamps
  m.created_at AS material_created_at,
  m.updated_at AS material_updated_at
  
FROM public.materials m
LEFT JOIN public.stock_items si ON si.material_id = m.id
WHERE m.is_archived = FALSE
ORDER BY m.name;

-- Comentário na view
COMMENT ON VIEW public.vw_cost_audit IS 
  'View de auditoria de custos e rastreabilidade. Usa função SECURITY DEFINER para acesso seguro a emails de usuários.';

-- Grant para usuários autenticados
GRANT SELECT ON public.vw_cost_audit TO authenticated;
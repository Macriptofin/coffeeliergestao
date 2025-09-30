-- ============================================================
-- RELATÓRIOS E INVENTÁRIO DE ESTOQUE - FASE 1 (CORRIGIDO)
-- Views, Tabelas e RPCs para gestão de inventário
-- ============================================================

-- ============================================================
-- 1. VIEWS DE RELATÓRIOS
-- ============================================================

-- View: Itens com quantidade zerada
CREATE OR REPLACE VIEW public.vw_stock_zero AS
SELECT 
  m.id AS material_id,
  m.code,
  m.name,
  m.category,
  m.subcategory,
  m.material_type,
  COALESCE(s.current_quantity, 0) AS current_quantity,
  s.average_price,
  CASE 
    WHEN s.material_id IS NULL THEN false
    ELSE true
  END AS has_stock_record
FROM public.materials m
LEFT JOIN public.stock_items s ON s.material_id = m.id
WHERE COALESCE(s.current_quantity, 0) = 0
  AND m.is_archived = false;

COMMENT ON VIEW public.vw_stock_zero IS 'Materiais sem registro de estoque ou com quantidade zerada';

-- View: Itens abaixo do mínimo
CREATE OR REPLACE VIEW public.vw_stock_below_min AS
SELECT 
  m.id AS material_id,
  m.code,
  m.name,
  m.category,
  m.subcategory,
  m.material_type,
  s.current_quantity,
  s.minimum_quantity,
  (s.minimum_quantity - s.current_quantity) AS deficit_quantity,
  s.average_price,
  (s.minimum_quantity - s.current_quantity) * COALESCE(s.average_price, 0) AS estimated_cost
FROM public.materials m
JOIN public.stock_items s ON s.material_id = m.id
WHERE s.current_quantity < s.minimum_quantity
  AND m.is_archived = false
ORDER BY (s.minimum_quantity - s.current_quantity) DESC;

COMMENT ON VIEW public.vw_stock_below_min IS 'Materiais com estoque abaixo do mínimo configurado';

-- View: Itens sem preço médio
CREATE OR REPLACE VIEW public.vw_stock_no_avg_price AS
SELECT 
  m.id AS material_id,
  m.code,
  m.name,
  m.category,
  m.subcategory,
  m.material_type,
  s.current_quantity,
  m.price_per_purchase_unit,
  s.total_value
FROM public.materials m
JOIN public.stock_items s ON s.material_id = m.id
WHERE COALESCE(s.average_price, 0) = 0
  AND s.current_quantity > 0
  AND m.is_archived = false;

COMMENT ON VIEW public.vw_stock_no_avg_price IS 'Materiais sem preço médio calculado (necessário para valorização)';

-- ============================================================
-- 2. TABELA DE CICLOS DE INVENTÁRIO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT valid_status CHECK (status IN ('draft', 'counting', 'reconciling', 'closed'))
);

COMMENT ON TABLE public.inventory_cycles IS 'Ciclos de inventário para contagem e reconciliação de estoque';
COMMENT ON COLUMN public.inventory_cycles.status IS 'draft: rascunho | counting: em contagem | reconciling: em reconciliação | closed: fechado';

-- Índices
CREATE INDEX IF NOT EXISTS idx_inventory_cycles_status ON public.inventory_cycles(status);
CREATE INDEX IF NOT EXISTS idx_inventory_cycles_created_by ON public.inventory_cycles(created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_cycles_created_at ON public.inventory_cycles(created_at DESC);

-- ============================================================
-- 3. ALTERAÇÃO DA TABELA inventory_adjustments
-- ============================================================

-- Adicionar colunas para vincular ajustes a ciclos
ALTER TABLE public.inventory_adjustments 
ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.inventory_cycles(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_adjustments 
ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.inventory_adjustments.cycle_id IS 'Vínculo com ciclo de inventário (opcional)';
COMMENT ON COLUMN public.inventory_adjustments.is_draft IS 'Se true, ajuste ainda não foi aplicado ao estoque';

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_cycle ON public.inventory_adjustments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_draft ON public.inventory_adjustments(is_draft) WHERE is_draft = true;

-- ============================================================
-- 4. RPCs PARA GESTÃO DE CICLOS
-- ============================================================

-- RPC: Criar ciclo de inventário
CREATE OR REPLACE FUNCTION public.rpc_inventory_create_cycle(
  p_name text, 
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_cycle_id uuid;
BEGIN
  INSERT INTO public.inventory_cycles (name, notes, created_by, status)
  VALUES (p_name, p_notes, auth.uid(), 'draft')
  RETURNING id INTO new_cycle_id;
  
  RETURN new_cycle_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_create_cycle IS 'Cria um novo ciclo de inventário';

-- RPC: Adicionar materiais a um ciclo (draft)
CREATE OR REPLACE FUNCTION public.rpc_inventory_add_materials(
  p_cycle_id uuid, 
  p_material_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  -- Verificar se ciclo existe e está em draft
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_cycles 
    WHERE id = p_cycle_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Ciclo não encontrado ou não está em rascunho';
  END IF;
  
  -- Inserir ajustes em draft para cada material
  INSERT INTO public.inventory_adjustments (
    cycle_id, 
    material_id, 
    system_quantity, 
    physical_quantity, 
    is_draft,
    adjustment_reason,
    responsible_user_id
  )
  SELECT 
    p_cycle_id, 
    m.id, 
    COALESCE(s.current_quantity, 0), 
    NULL, 
    true,
    'Contagem de inventário',
    auth.uid()
  FROM unnest(p_material_ids) AS m(id)
  LEFT JOIN public.stock_items s ON s.material_id = m.id
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_add_materials IS 'Adiciona materiais a um ciclo de inventário em rascunho';

-- RPC: Atualizar status do ciclo
CREATE OR REPLACE FUNCTION public.rpc_inventory_update_status(
  p_cycle_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar status
  IF p_new_status NOT IN ('draft', 'counting', 'reconciling', 'closed') THEN
    RAISE EXCEPTION 'Status inválido: %', p_new_status;
  END IF;
  
  -- Atualizar status
  UPDATE public.inventory_cycles
  SET 
    status = p_new_status,
    started_at = CASE 
      WHEN p_new_status = 'counting' AND started_at IS NULL THEN now() 
      ELSE started_at 
    END,
    closed_at = CASE 
      WHEN p_new_status = 'closed' THEN now() 
      ELSE closed_at 
    END,
    closed_by = CASE 
      WHEN p_new_status = 'closed' THEN auth.uid() 
      ELSE closed_by 
    END
  WHERE id = p_cycle_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ciclo não encontrado: %', p_cycle_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_update_status IS 'Atualiza o status de um ciclo de inventário';

-- RPC: Finalizar ciclo (aplica diferenças e fecha)
CREATE OR REPLACE FUNCTION public.rpc_inventory_finalize(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adjustments_count integer := 0;
  affected_materials integer := 0;
  total_value_change numeric := 0;
BEGIN
  -- Verificar se ciclo existe
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_cycles 
    WHERE id = p_cycle_id
  ) THEN
    RAISE EXCEPTION 'Ciclo não encontrado';
  END IF;
  
  -- Contar ajustes a processar
  SELECT COUNT(*) INTO adjustments_count
  FROM public.inventory_adjustments
  WHERE cycle_id = p_cycle_id 
    AND is_draft = true
    AND physical_quantity IS NOT NULL;
  
  -- Aplicar ajustes usando a função existente
  WITH adjustments_to_process AS (
    SELECT 
      ia.id,
      ia.material_id,
      ia.physical_quantity,
      ia.adjustment_reason,
      ia.reference_document,
      ia.notes
    FROM public.inventory_adjustments ia
    WHERE ia.cycle_id = p_cycle_id 
      AND ia.is_draft = true
      AND ia.physical_quantity IS NOT NULL
  )
  UPDATE public.stock_items s
  SET 
    current_quantity = a.physical_quantity,
    last_movement_date = now(),
    updated_at = now(),
    total_value = a.physical_quantity * COALESCE(s.average_price, 0)
  FROM adjustments_to_process a
  WHERE s.material_id = a.material_id;
  
  GET DIAGNOSTICS affected_materials = ROW_COUNT;
  
  -- Marcar ajustes como aplicados
  UPDATE public.inventory_adjustments
  SET is_draft = false
  WHERE cycle_id = p_cycle_id AND is_draft = true;
  
  -- Fechar ciclo
  UPDATE public.inventory_cycles
  SET 
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid()
  WHERE id = p_cycle_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'cycle_id', p_cycle_id,
    'adjustments_processed', adjustments_count,
    'materials_affected', affected_materials,
    'closed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_finalize IS 'Finaliza um ciclo de inventário aplicando todos os ajustes ao estoque';

-- ============================================================
-- 5. RLS POLICIES (apenas se não existir)
-- ============================================================

-- Ativar RLS na tabela
ALTER TABLE public.inventory_cycles ENABLE ROW LEVEL SECURITY;

-- Remover policy antiga se existir e recriar
DROP POLICY IF EXISTS "Admins and managers can manage inventory_cycles" ON public.inventory_cycles;

CREATE POLICY "Admins and managers can manage inventory_cycles"
  ON public.inventory_cycles
  FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));
-- Adicionar campos para workflow e desconto global na tabela purchase_invoices
ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'rascunho',
ADD COLUMN IF NOT EXISTS discount_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'value',
ADD COLUMN IF NOT EXISTS items_locked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS edit_approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edit_approved_at timestamp with time zone;

-- Atualizar notas existentes que já foram lançadas
UPDATE public.purchase_invoices
SET workflow_status = 'lancada'
WHERE stock_posted = true;

-- Atualizar notas existentes que não foram lançadas mas têm itens
UPDATE public.purchase_invoices
SET workflow_status = 'pendente'
WHERE stock_posted = false AND id IN (SELECT DISTINCT invoice_id FROM invoice_items);

-- Adicionar coluna de desconto individual nos itens
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_price numeric;

-- Função para calcular rateio de desconto global
CREATE OR REPLACE FUNCTION public.apply_global_discount_to_invoice(
  p_invoice_id uuid,
  p_discount_total numeric,
  p_discount_type text DEFAULT 'value'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_subtotal numeric;
  v_discount_value numeric;
  v_item record;
  v_item_proportion numeric;
  v_item_discount numeric;
BEGIN
  -- Calcular subtotal da nota (soma dos totais dos itens)
  SELECT COALESCE(SUM(total_price), 0) INTO v_invoice_subtotal
  FROM invoice_items
  WHERE invoice_id = p_invoice_id;
  
  IF v_invoice_subtotal = 0 THEN
    RETURN;
  END IF;
  
  -- Calcular valor do desconto baseado no tipo
  IF p_discount_type = 'percent' THEN
    v_discount_value := (p_discount_total / 100) * v_invoice_subtotal;
  ELSE
    v_discount_value := p_discount_total;
  END IF;
  
  -- Ratear desconto proporcionalmente entre os itens
  FOR v_item IN 
    SELECT id, total_price 
    FROM invoice_items 
    WHERE invoice_id = p_invoice_id
  LOOP
    -- Proporção deste item no total
    v_item_proportion := v_item.total_price / v_invoice_subtotal;
    
    -- Desconto proporcional para este item
    v_item_discount := v_discount_value * v_item_proportion;
    
    -- Atualizar item
    UPDATE invoice_items
    SET 
      discount_amount = v_item_discount,
      discount_percent = CASE WHEN v_item.total_price > 0 
        THEN (v_item_discount / v_item.total_price) * 100 
        ELSE 0 END,
      final_price = v_item.total_price - v_item_discount
    WHERE id = v_item.id;
  END LOOP;
  
  -- Atualizar total da nota
  UPDATE purchase_invoices
  SET 
    discount_total = v_discount_value,
    discount_type = p_discount_type,
    total_amount = v_invoice_subtotal - v_discount_value
  WHERE id = p_invoice_id;
END;
$$;

-- Função para verificar se usuário pode editar itens da nota
CREATE OR REPLACE FUNCTION public.can_edit_invoice_items(
  p_invoice_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_is_admin boolean;
BEGIN
  -- Buscar dados da nota
  SELECT items_locked, workflow_status INTO v_invoice
  FROM purchase_invoices
  WHERE id = p_invoice_id;
  
  -- Verificar se é admin
  SELECT has_role(p_user_id, 'admin') INTO v_is_admin;
  
  -- Se não está travada, qualquer gerente pode editar
  IF NOT v_invoice.items_locked THEN
    RETURN is_admin_or_manager(p_user_id);
  END IF;
  
  -- Se está travada e já foi lançada, apenas admin
  IF v_invoice.workflow_status = 'lancada' THEN
    RETURN v_is_admin;
  END IF;
  
  -- Para outros casos, apenas admin pode desbloquear
  RETURN v_is_admin;
END;
$$;

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_workflow_status ON public.purchase_invoices(workflow_status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_final_price ON public.invoice_items(final_price);

-- Comentários
COMMENT ON COLUMN public.purchase_invoices.workflow_status IS 'Status do workflow: rascunho, pendente, lancada';
COMMENT ON COLUMN public.purchase_invoices.discount_total IS 'Valor total do desconto global aplicado na nota';
COMMENT ON COLUMN public.purchase_invoices.discount_type IS 'Tipo do desconto: value (valor fixo) ou percent (percentual)';
COMMENT ON COLUMN public.purchase_invoices.items_locked IS 'Se true, itens só podem ser editados por admin';
COMMENT ON COLUMN public.invoice_items.final_price IS 'Preço final após aplicação de descontos';
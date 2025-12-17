-- Adicionar campos de frete na nota fiscal
ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS freight_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS freight_cost_center_id uuid REFERENCES public.cost_centers(id);

-- Criar centro de custo padrão para frete se não existir
INSERT INTO public.cost_centers (code, name, description, is_active)
SELECT '005', 'Frete e Logística', 'Despesas com frete, entregas e logística', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.cost_centers WHERE code = '005' OR name ILIKE '%frete%'
);

-- Índice para consultas por centro de custo de frete
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_freight_cost_center 
ON public.purchase_invoices(freight_cost_center_id) 
WHERE freight_amount > 0;
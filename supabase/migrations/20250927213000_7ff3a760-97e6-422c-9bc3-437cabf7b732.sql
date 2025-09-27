-- Limpar todos os materiais finished_product vazios
-- Primeiro remover itens de estoque relacionados
DELETE FROM public.stock_items 
WHERE material_id IN (
  SELECT id FROM public.materials 
  WHERE material_type = 'finished_product'
);

-- Remover movimentações de estoque relacionadas
DELETE FROM public.stock_movements 
WHERE material_id IN (
  SELECT id FROM public.materials 
  WHERE material_type = 'finished_product'
);

-- Remover todos os materiais finished_product
DELETE FROM public.materials 
WHERE material_type = 'finished_product';

-- Log da operação
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'CLEANUP_FINISHED_PRODUCTS',
  jsonb_build_object(
    'timestamp', now(),
    'reason', 'Limpeza completa dos produtos acabados vazios para recriação',
    'affected_tables', ARRAY['materials', 'stock_items', 'stock_movements']
  ),
  auth.uid()
);
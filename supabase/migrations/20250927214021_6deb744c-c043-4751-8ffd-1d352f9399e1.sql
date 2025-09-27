-- Adicionar coluna subcategoria na tabela materials
ALTER TABLE public.materials 
ADD COLUMN subcategory text;

-- Criar índice para performance de consultas por categoria/subcategoria
CREATE INDEX idx_materials_category_subcategory ON public.materials(category, subcategory);

-- Atualizar trigger de audit se necessário (mantém compatibilidade)
COMMENT ON COLUMN public.materials.subcategory IS 'Subcategoria hierárquica do material para melhor organização';

-- Log da operação
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'ADD_SUBCATEGORY_SUPPORT',
  jsonb_build_object(
    'timestamp', now(),
    'change', 'Adicionada coluna subcategory na tabela materials',
    'reason', 'Reestruturação para categorias hierárquicas'
  ),
  auth.uid()
);
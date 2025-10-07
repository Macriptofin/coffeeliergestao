-- Adicionar campos de densidade e peso unitário à tabela materials
-- Para suportar conversão de volume → massa e unidades → massa

-- Adicionar campo de densidade (g/mL) para materiais volumétricos
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS density_g_per_ml NUMERIC(10,5) NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.materials.density_g_per_ml IS 'Densidade em gramas por mililitro. Use para materiais com unidade volumétrica (mL/L) para calcular peso. Ex: água=1.00, leite=1.03';

-- Manter o campo unit_weight existente, mas adicionar comentário melhor
COMMENT ON COLUMN public.materials.unit_weight IS 'Peso em gramas por unidade de uso. Use para unidades não-peso e não-volume (un, pacote, etc). Ex: 1 ovo = 50g';

-- Índice para facilitar queries de materiais volumétricos com densidade
CREATE INDEX IF NOT EXISTS idx_materials_density 
ON public.materials(density_g_per_ml) 
WHERE density_g_per_ml IS NOT NULL;

-- Log da mudança
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'SCHEMA_ENHANCEMENT',
  jsonb_build_object(
    'change', 'add_density_field',
    'reason', 'support_volume_to_mass_conversion',
    'fields_added', ARRAY['density_g_per_ml'],
    'timestamp', now()
  ),
  auth.uid()
);
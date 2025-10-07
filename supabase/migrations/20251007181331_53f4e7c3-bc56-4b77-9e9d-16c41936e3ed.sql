-- Atualizar materiais volumétricos existentes com densidade padrão
-- Para materiais com unidade de uso mL ou L que ainda não têm densidade definida

-- Densidade padrão de 1.00 (água) para materiais volumétricos sem densidade
UPDATE public.materials
SET density_g_per_ml = 1.00,
    updated_at = now()
WHERE (usage_unit ILIKE 'ml' OR usage_unit ILIKE 'l')
  AND density_g_per_ml IS NULL;

-- Densidade específica para leite (1.03 g/mL)
UPDATE public.materials
SET density_g_per_ml = 1.03,
    updated_at = now()
WHERE (name ILIKE '%leite%' OR name ILIKE '%milk%')
  AND (usage_unit ILIKE 'ml' OR usage_unit ILIKE 'l');

-- Densidade específica para óleos (0.92 g/mL)
UPDATE public.materials
SET density_g_per_ml = 0.92,
    updated_at = now()
WHERE (name ILIKE '%óleo%' OR name ILIKE '%azeite%' OR name ILIKE '%oil%')
  AND (usage_unit ILIKE 'ml' OR usage_unit ILIKE 'l');

-- Densidade específica para mel (1.42 g/mL)
UPDATE public.materials
SET density_g_per_ml = 1.42,
    updated_at = now()
WHERE name ILIKE '%mel%'
  AND (usage_unit ILIKE 'ml' OR usage_unit ILIKE 'l');

-- Log da atualização
INSERT INTO public.ops_bom_audit_log (action, detail, user_id)
VALUES (
  'BACKFILL_DENSITY',
  jsonb_build_object(
    'action', 'set_default_densities',
    'timestamp', now(),
    'materials_updated', (
      SELECT COUNT(*) FROM public.materials 
      WHERE (usage_unit ILIKE 'ml' OR usage_unit ILIKE 'l') 
      AND density_g_per_ml IS NOT NULL
    )
  ),
  auth.uid()
);
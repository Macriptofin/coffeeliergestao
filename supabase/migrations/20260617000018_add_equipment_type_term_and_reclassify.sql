-- 1) Criar o termo "Equipamento" na taxonomia de tipos (estava faltando; equipment
--    só existia via truque de override de categoria no frontend).
INSERT INTO public.taxonomy_terms (id, taxonomy_id, name, code, sort_order, parent_id, is_active)
SELECT gen_random_uuid(), d.id, 'Equipamento', 'EQP009', 9, NULL, true
FROM public.taxonomy_definitions d
WHERE d.key = 'material_type'
  AND NOT EXISTS (
    SELECT 1 FROM public.taxonomy_terms tt
    WHERE tt.taxonomy_id = d.id AND tt.name = 'Equipamento'
  );

-- 2) Reclassificar Forno e Ventilador (já na categoria Equipamentos) para tipo Equipamento
UPDATE public.materials
   SET material_type = 'equipment',
       type_term_id = (SELECT tt.id FROM public.taxonomy_terms tt
                       JOIN public.taxonomy_definitions d ON d.id=tt.taxonomy_id AND d.key='material_type'
                       WHERE tt.name='Equipamento' LIMIT 1)
 WHERE code IN ('INS0132','INS0156');

-- 3) Garrafa Térmica Inox: durável → Equipamento + mover categoria Operacionais → Equipamentos
UPDATE public.materials
   SET material_type = 'equipment',
       type_term_id = (SELECT tt.id FROM public.taxonomy_terms tt
                       JOIN public.taxonomy_definitions d ON d.id=tt.taxonomy_id AND d.key='material_type'
                       WHERE tt.name='Equipamento' LIMIT 1),
       category = 'Equipamentos',
       category_term_id = (SELECT tt.id FROM public.taxonomy_terms tt
                           JOIN public.taxonomy_definitions d ON d.id=tt.taxonomy_id AND d.key='material_category'
                           WHERE tt.name='Equipamentos' LIMIT 1),
       subcategory = NULL,
       subcategory_term_id = NULL
 WHERE code = 'PCO0001';

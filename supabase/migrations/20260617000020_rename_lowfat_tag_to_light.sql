-- Renomeia a tag de característica "Low Fat / Fitness" → "Light" para casar com a
-- seção da proposta. Código REST_LOWFAT mantido estável (identidade da tag).
UPDATE public.taxonomy_terms tt
   SET name = 'Light'
  FROM public.taxonomy_definitions d
 WHERE d.id = tt.taxonomy_id
   AND d.key = 'material_restriction'
   AND tt.code = 'REST_LOWFAT';

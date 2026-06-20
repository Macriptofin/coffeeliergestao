-- Exclusão (desativação via is_archived) de 26 materiais duplicados/obsoletos.
-- Regra do sistema: nunca apagar fisicamente, somente desativar — preserva histórico
-- de NF, movimentação de estoque, fichas técnicas e propostas.
-- 3 itens exigiam consolidação (merge) antes do arquivamento por terem uso ativo:
--   MAT00045 "Óleo"         -> fichas repontadas para MAT00239 "Oleo de Soja"
--   MAT00060 "Água sem Gás" -> fichas repontadas para MAT00088 "Água Mineral sem Gás"
-- (MAT00175 está em 2 propostas históricas; arquivado por decisão — histórico preservado.)

-- 1) Merge Óleo -> Oleo de Soja nas fichas técnicas
UPDATE public.recipe_bom_items
SET material_id = (SELECT id FROM public.materials WHERE code = 'MAT00239')
WHERE material_id = (SELECT id FROM public.materials WHERE code = 'MAT00045');

-- 2) Merge Água sem Gás -> Água Mineral sem Gás nas fichas técnicas
UPDATE public.recipe_bom_items
SET material_id = (SELECT id FROM public.materials WHERE code = 'MAT00088')
WHERE material_id = (SELECT id FROM public.materials WHERE code = 'MAT00060');

-- 3) Desativar (arquivar) os 26 materiais da lista de exclusão
UPDATE public.materials
SET is_archived = true, updated_at = now()
WHERE code IN ('MAT00222','MAT00060','MAT00179','MAT00217','MAT00159','MAT00216',
 'MAT00167','MAT00030','MAT00045','MAT00232','MAT00177','MAT00068',
 'MAT00042','MAT00119','MAT00168','MAT00213','MAT00152','MAT00156',
 'MAT00154','MAT00155','MAT00210','MAT00227','MAT00090','MAT00022',
 'MAT00175','MAT00137');

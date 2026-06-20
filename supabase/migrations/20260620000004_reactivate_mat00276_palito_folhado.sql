-- MAT00276 "Palito folhado de chocolate ao leite": produto acabado real com ficha
-- técnica própria, arquivado por engano. Reativado (volta ao cadastro ativo).
UPDATE public.materials SET is_archived = false, updated_at = now() WHERE code = 'MAT00276';

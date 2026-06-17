-- Limpeza dos dropdowns: inativa termos legados/órfãos (categorias não-canônicas
-- e subcategorias sob elas) que NÃO são usados por nenhum material. Não deleta
-- (preserva histórico); apenas tira da listagem de Configurações.

-- Subcategorias órfãs (pai não-canônico) sem uso
UPDATE public.taxonomy_terms SET is_active = false
WHERE id IN (
  SELECT sub.id
  FROM public.taxonomy_terms sub
  JOIN public.taxonomy_definitions d ON d.id = sub.taxonomy_id AND d.key = 'material_subcategory'
  LEFT JOIN public.taxonomy_terms par ON par.id = sub.parent_id
  WHERE sub.is_active = true
    AND coalesce(par.name,'') NOT IN ('Alimentos & Ingredientes','Doces & Confeitaria','Salgados','Bebidas',
                                      'Embalagem','Higiene e Limpeza','Equipamentos','Operacionais','Kits & Mesas')
    AND NOT EXISTS (SELECT 1 FROM public.materials m WHERE m.subcategory_term_id = sub.id)
);

-- Categorias não-canônicas sem uso
UPDATE public.taxonomy_terms SET is_active = false
WHERE id IN (
  SELECT cat.id
  FROM public.taxonomy_terms cat
  JOIN public.taxonomy_definitions d ON d.id = cat.taxonomy_id AND d.key = 'material_category'
  WHERE cat.is_active = true
    AND cat.name NOT IN ('Alimentos & Ingredientes','Doces & Confeitaria','Salgados','Bebidas',
                         'Embalagem','Higiene e Limpeza','Equipamentos','Operacionais','Kits & Mesas')
    AND NOT EXISTS (SELECT 1 FROM public.materials m WHERE m.category_term_id = cat.id)
);

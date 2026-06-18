-- Reconciliação aprovada pelo usuário: 9 produtos de revenda cujo type_term_id
-- estava no default-lixo "Produto Acabado". material_type já = 'resale_product';
-- alinhamos o type_term_id ao termo correto para lista e formulário baterem.
UPDATE public.materials
   SET type_term_id = (
     SELECT tt.id FROM public.taxonomy_terms tt
     JOIN public.taxonomy_definitions d ON d.id = tt.taxonomy_id AND d.key='material_type'
     WHERE tt.name = 'Produto de Revenda' LIMIT 1
   )
 WHERE code IN ('INS0153','INS0159','INS0182','INS0062','INS0155','INS0039','INS0045','PAC0001','INS0124')
   AND material_type = 'resale_product';

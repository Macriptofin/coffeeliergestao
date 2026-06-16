-- term_id é a fonte da verdade: onde há subcategory_term_id/category_term_id,
-- o texto passa a refletir exatamente o nome do termo (elimina divergência).
UPDATE materials m
SET subcategory = st.name
FROM taxonomy_terms st
WHERE st.id = m.subcategory_term_id
  AND coalesce(m.is_archived,false) = false
  AND m.subcategory IS DISTINCT FROM st.name;

UPDATE materials m
SET category = ct.name
FROM taxonomy_terms ct
WHERE ct.id = m.category_term_id
  AND coalesce(m.is_archived,false) = false
  AND m.category IS DISTINCT FROM ct.name;

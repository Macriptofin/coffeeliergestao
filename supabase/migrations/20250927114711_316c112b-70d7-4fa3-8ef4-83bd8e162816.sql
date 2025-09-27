-- [Doc] Migração de Segurança: Habilitar RLS e corrigir search_path

-- Corrigir função set_updated_at com search_path seguro
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$f$;

-- Habilitar RLS nas novas tabelas
ALTER TABLE recipes_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE composites_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE composite_bom_items ENABLE ROW LEVEL SECURITY;

-- Políticas para recipes_bom
CREATE POLICY "Anyone authenticated can view recipes_bom" 
ON recipes_bom FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage recipes_bom" 
ON recipes_bom FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Políticas para recipe_bom_items
CREATE POLICY "Anyone authenticated can view recipe_bom_items" 
ON recipe_bom_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage recipe_bom_items" 
ON recipe_bom_items FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Políticas para composites_bom
CREATE POLICY "Anyone authenticated can view composites_bom" 
ON composites_bom FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage composites_bom" 
ON composites_bom FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Políticas para composite_bom_items
CREATE POLICY "Anyone authenticated can view composite_bom_items" 
ON composite_bom_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage composite_bom_items" 
ON composite_bom_items FOR ALL 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));
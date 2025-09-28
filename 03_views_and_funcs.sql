-- =====================================
-- VIEWS E FUNCTIONS - Sistema Coffeelier
-- =====================================

-- PRINCIPAIS FUNCTIONS DE SEGURANÇA E RLS

-- Function para verificar roles (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function para verificar admin/manager (mais usada)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- FUNCTIONS DE MASCARAMENTO PII

CREATE OR REPLACE FUNCTION public.mask_email(email_value text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF email_value IS NULL OR LENGTH(email_value) < 5 OR email_value NOT LIKE '%@%' THEN
    RETURN email_value;
  END IF;
  RETURN LEFT(email_value, 2) || '***@' || SPLIT_PART(email_value, '@', 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_cnpj_cpf(cnpj_cpf_value text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF cnpj_cpf_value IS NULL OR LENGTH(cnpj_cpf_value) < 6 THEN
    RETURN cnpj_cpf_value;
  END IF;
  
  -- For CNPJ (14 digits) - show only last 4
  IF LENGTH(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g')) = 14 THEN
    RETURN '**.***.***/**' || RIGHT(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g'), 4);
  END IF;
  
  -- For CPF (11 digits) - show only last 2
  RETURN '***.***.**' || RIGHT(REGEXP_REPLACE(cnpj_cpf_value, '[^0-9]', '', 'g'), 2);
END;
$$;

-- FUNCTIONS DE BOM E PRODUÇÃO

-- Sanitizar BOMs duplicadas por material
CREATE OR REPLACE FUNCTION public.sanitize_bom_for_material(finished_material uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bom_count INTEGER;
  canonical_bom RECORD;
  other_bom RECORD;
  result JSONB := '{}';
BEGIN
  -- Count BOMs for this material
  SELECT COUNT(*) INTO bom_count
  FROM public.recipes_bom
  WHERE finished_material_id = finished_material;
  
  IF bom_count <= 1 THEN
    RETURN jsonb_build_object('status', 'ok', 'message', 'Material has single or no BOM');
  END IF;
  
  -- Find canonical BOM (most items, most recent)
  SELECT rb.*, COUNT(rbi.id) as item_count
  INTO canonical_bom
  FROM public.recipes_bom rb
  LEFT JOIN public.recipe_bom_items rbi ON rbi.recipe_id = rb.id
  WHERE rb.finished_material_id = finished_material
  GROUP BY rb.id, rb.finished_material_id, rb.yield_quantity, rb.notes, rb.created_at, rb.updated_at
  ORDER BY COUNT(rbi.id) DESC, rb.created_at DESC
  LIMIT 1;
  
  -- Move items from other BOMs to canonical
  FOR other_bom IN
    SELECT rb.*
    FROM public.recipes_bom rb
    WHERE rb.finished_material_id = finished_material
      AND rb.id != canonical_bom.id
  LOOP
    -- Move items to canonical BOM (consolidating duplicates)
    INSERT INTO public.recipe_bom_items (recipe_id, material_id, quantity, unit, position, is_packaging)
    SELECT 
      canonical_bom.id,
      rbi.material_id,
      rbi.quantity,
      rbi.unit,
      rbi.position,
      rbi.is_packaging
    FROM public.recipe_bom_items rbi
    WHERE rbi.recipe_id = other_bom.id
    ON CONFLICT (recipe_id, material_id) DO UPDATE SET
      quantity = recipe_bom_items.quantity + EXCLUDED.quantity;
    
    -- Delete moved items
    DELETE FROM public.recipe_bom_items WHERE recipe_id = other_bom.id;
    
    -- Delete empty BOM
    DELETE FROM public.recipes_bom WHERE id = other_bom.id;
  END LOOP;
  
  result := jsonb_build_object(
    'status', 'sanitized',
    'canonical_bom_id', canonical_bom.id,
    'removed_bom_count', bom_count - 1
  );
  
  RETURN result;
END;
$$;

-- FUNCTIONS DE CONFIGURAÇÃO

CREATE OR REPLACE FUNCTION public.get_config(p_namespace text, p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    cv.value_jsonb,
    co.default_value,
    'null'::jsonb
  )
  FROM config_namespaces cn
  LEFT JOIN config_options co ON co.namespace_id = cn.id AND co.key = p_key
  LEFT JOIN config_values cv ON cv.namespace_id = cn.id AND cv.key = p_key
  WHERE cn.key = p_namespace;
$$;

-- FUNCTIONS DE TAXONOMIA

CREATE OR REPLACE FUNCTION public.import_taxonomy_from_csv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category_record RECORD;
  subcategory_record RECORD;
  parent_category_id uuid;
  category_taxonomy_id uuid;
  subcategory_taxonomy_id uuid;
  imported_categories integer := 0;
  imported_subcategories integer := 0;
  result jsonb;
BEGIN
  -- Get taxonomy IDs
  SELECT id INTO category_taxonomy_id 
  FROM taxonomy_definitions 
  WHERE key = 'material_category';
  
  SELECT id INTO subcategory_taxonomy_id 
  FROM taxonomy_definitions 
  WHERE key = 'material_subcategory';
  
  -- Import predefined categories and subcategories
  -- (Implementation truncated for brevity)
  
  result := jsonb_build_object(
    'success', true,
    'imported_categories', imported_categories,
    'imported_subcategories', imported_subcategories,
    'message', 'Taxonomia importada com sucesso!'
  );

  RETURN result;
END;
$$;

-- TRIGGERS ATIVOS

-- Trigger para auditoria de configurações
CREATE OR REPLACE FUNCTION public.audit_config_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, after)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, before, after)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO ops_config_audit_log (actor, action, entity, entity_id, before)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger para geração automática de códigos
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.suppliers 
  WHERE code LIKE 'FORN-%';
  
  new_code := 'FORN-' || LPAD(next_number::text, 4, '0');
  NEW.code := new_code;
  RETURN NEW;
END;
$$;

-- Trigger para atualização de timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
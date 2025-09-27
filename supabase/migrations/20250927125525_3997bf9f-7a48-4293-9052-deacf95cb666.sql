-- Dados de exemplo e configuração final do módulo Mesas/Eventos

-- Perfil de consumo padrão
INSERT INTO public.consumption_profiles (name, grams_per_person, notes) 
VALUES 
  ('Intervalo 15min – 200g/pessoa', 200, 'Perfil padrão para eventos de 15 minutos'),
  ('Coffee Break – 350g/pessoa', 350, 'Para eventos de coffee break com maior variedade'),
  ('Evento Completo – 600g/pessoa', 600, 'Para eventos longos com refeição completa')
ON CONFLICT DO NOTHING;

-- Mix dos perfis padrão
DO $$
DECLARE
  profile_id_200 uuid;
  profile_id_350 uuid;
  profile_id_600 uuid;
BEGIN
  -- Perfil 200g
  SELECT id INTO profile_id_200 
  FROM public.consumption_profiles 
  WHERE name = 'Intervalo 15min – 200g/pessoa' 
  LIMIT 1;
  
  IF profile_id_200 IS NOT NULL THEN
    INSERT INTO public.consumption_profile_mix (profile_id, category_label, percent) VALUES
      (profile_id_200, 'Bebidas', 10),
      (profile_id_200, 'Salgados', 40),
      (profile_id_200, 'Doces', 30),
      (profile_id_200, 'Frutas', 20)
    ON CONFLICT (profile_id, category_label) DO NOTHING;
  END IF;

  -- Perfil 350g
  SELECT id INTO profile_id_350 
  FROM public.consumption_profiles 
  WHERE name = 'Coffee Break – 350g/pessoa' 
  LIMIT 1;
  
  IF profile_id_350 IS NOT NULL THEN
    INSERT INTO public.consumption_profile_mix (profile_id, category_label, percent) VALUES
      (profile_id_350, 'Bebidas', 20),
      (profile_id_350, 'Salgados', 35),
      (profile_id_350, 'Doces', 25),
      (profile_id_350, 'Frutas', 15),
      (profile_id_350, 'Sanduíches', 5)
    ON CONFLICT (profile_id, category_label) DO NOTHING;
  END IF;

  -- Perfil 600g
  SELECT id INTO profile_id_600 
  FROM public.consumption_profiles 
  WHERE name = 'Evento Completo – 600g/pessoa' 
  LIMIT 1;
  
  IF profile_id_600 IS NOT NULL THEN
    INSERT INTO public.consumption_profile_mix (profile_id, category_label, percent) VALUES
      (profile_id_600, 'Bebidas', 25),
      (profile_id_600, 'Salgados', 30),
      (profile_id_600, 'Doces', 20),
      (profile_id_600, 'Frutas', 10),
      (profile_id_600, 'Sanduíches', 10),
      (profile_id_600, 'Pratos Quentes', 5)
    ON CONFLICT (profile_id, category_label) DO NOTHING;
  END IF;
END $$;

-- Exemplo de material "Café Especial 100ml" para teste
INSERT INTO public.materials (
  name, 
  category, 
  material_type, 
  purchase_unit, 
  usage_unit, 
  conversion_factor, 
  price_per_purchase_unit,
  description
) VALUES (
  'Café Especial 100ml',
  'Produto Acabado',
  'finished_product',
  'litro',
  'ml',
  1000,
  25.00,
  'Café especial servido em porções de 100ml com embalagem completa'
) ON CONFLICT DO NOTHING;

-- Buscar ID do café para criar receita BOM
DO $$
DECLARE
  cafe_material_id uuid;
  cafe_recipe_id uuid;
  copo_material_id uuid;
  sache_material_id uuid;
  mexedor_material_id uuid;
BEGIN
  -- Buscar o café
  SELECT id INTO cafe_material_id 
  FROM public.materials 
  WHERE name = 'Café Especial 100ml' 
  LIMIT 1;
  
  IF cafe_material_id IS NOT NULL THEN
    -- Criar receita BOM para o café
    INSERT INTO public.recipes_bom (
      finished_material_id,
      yield_quantity,
      yield_unit,
      notes
    ) VALUES (
      cafe_material_id,
      1,
      'litro',
      'Receita para 1 litro de café especial (10 porções de 100ml)'
    ) 
    ON CONFLICT DO NOTHING
    RETURNING id INTO cafe_recipe_id;
  
    -- Se não retornou ID, buscar existente
    IF cafe_recipe_id IS NULL THEN
      SELECT id INTO cafe_recipe_id
      FROM public.recipes_bom
      WHERE finished_material_id = cafe_material_id
      LIMIT 1;
    END IF;
    
    -- Criar materiais de embalagem se não existirem
    INSERT INTO public.materials (name, category, material_type, purchase_unit, usage_unit, conversion_factor, price_per_purchase_unit)
    VALUES 
      ('Copo Descartável 100ml', 'Embalagem', 'packaging', 'pacote', 'unidade', 50, 15.00),
      ('Sachê de Açúcar', 'Embalagem', 'packaging', 'caixa', 'unidade', 100, 12.00),
      ('Mexedor de Café', 'Embalagem', 'packaging', 'pacote', 'unidade', 100, 8.00)
    ON CONFLICT DO NOTHING;
    
    -- Buscar IDs dos materiais de embalagem
    SELECT id INTO copo_material_id FROM public.materials WHERE name = 'Copo Descartável 100ml' LIMIT 1;
    SELECT id INTO sache_material_id FROM public.materials WHERE name = 'Sachê de Açúcar' LIMIT 1;
    SELECT id INTO mexedor_material_id FROM public.materials WHERE name = 'Mexedor de Café' LIMIT 1;
    
    -- Criar itens da receita BOM
    IF cafe_recipe_id IS NOT NULL THEN
      INSERT INTO public.recipe_bom_items (
        recipe_id, material_id, quantity, unit, is_packaging, position
      ) VALUES
        (cafe_recipe_id, copo_material_id, 10, 'unidade', true, 1),
        (cafe_recipe_id, sache_material_id, 10, 'unidade', true, 2),
        (cafe_recipe_id, mexedor_material_id, 10, 'unidade', true, 3)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
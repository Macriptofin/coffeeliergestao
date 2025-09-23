-- Criar tabelas para ingredientes e receitas
CREATE TABLE public.ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  purchase_unit TEXT NOT NULL,
  usage_unit TEXT NOT NULL,
  conversion_factor DECIMAL NOT NULL DEFAULT 1,
  price_per_purchase_unit DECIMAL NOT NULL,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  instructions TEXT,
  preparation_time INTEGER DEFAULT 0,
  difficulty TEXT CHECK (difficulty IN ('Fácil', 'Médio', 'Difícil')),
  yield_amount INTEGER NOT NULL,
  total_cost DECIMAL,
  suggested_price DECIMAL,
  profit_margin DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir acesso público por enquanto)
CREATE POLICY "Allow all access to ingredients" ON public.ingredients FOR ALL USING (true);
CREATE POLICY "Allow all access to recipes" ON public.recipes FOR ALL USING (true);
CREATE POLICY "Allow all access to recipe_ingredients" ON public.recipe_ingredients FOR ALL USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
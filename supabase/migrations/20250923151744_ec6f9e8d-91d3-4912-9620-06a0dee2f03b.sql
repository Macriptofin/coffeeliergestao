-- Secure RLS policies to require authentication on all tables
-- Enable RLS explicitly (safe if already enabled)
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive existing policies if present
DROP POLICY IF EXISTS "Authenticated users can manage ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Authenticated users can manage recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated users can manage recipe_ingredients" ON public.recipe_ingredients;

-- Create strict policies: only authenticated users can read/write
CREATE POLICY "Manage ingredients (auth only)"
ON public.ingredients
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manage recipes (auth only)"
ON public.recipes
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manage recipe_ingredients (auth only)"
ON public.recipe_ingredients
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update RLS policies to require authentication instead of allowing public access
DROP POLICY IF EXISTS "Allow all access to ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Allow all access to recipes" ON public.recipes;
DROP POLICY IF EXISTS "Allow all access to recipe_ingredients" ON public.recipe_ingredients;

-- Create new policies that require authentication
CREATE POLICY "Authenticated users can manage ingredients" 
ON public.ingredients 
FOR ALL 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage recipes" 
ON public.recipes 
FOR ALL 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can manage recipe_ingredients" 
ON public.recipe_ingredients 
FOR ALL 
TO authenticated 
USING (true);
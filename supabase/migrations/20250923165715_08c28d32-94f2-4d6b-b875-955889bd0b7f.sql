-- Create function to check if any admin exists
CREATE OR REPLACE FUNCTION public.no_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;

-- Add bootstrap policy to allow first admin creation
CREATE POLICY "Allow first admin bootstrap"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.no_admin_exists() AND 
  (SELECT role FROM (VALUES (NEW.role)) AS t(role)) = 'admin'
);

-- Update the SELECT policy to allow checking for existing admins during bootstrap
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles or check admin existence"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  public.no_admin_exists()
);
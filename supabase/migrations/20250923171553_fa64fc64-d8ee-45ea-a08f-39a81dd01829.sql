-- Clean up duplicate roles - keep highest privilege role per user
-- Remove the duplicate 'user' role for the user who also has 'admin' role
DELETE FROM public.user_roles 
WHERE id = '91aa8cd4-b84a-40b8-911b-5b9f5492acf1';

-- Now add the unique constraint
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Create security function to check if requester is admin (not the target user)
CREATE OR REPLACE FUNCTION public.is_admin_not_self(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND _user_id != _target_user_id
  )
$$;

-- Create function to check if any admin exists (for bootstrap)
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  )
$$;

-- Drop existing policies and recreate with stronger security
DROP POLICY IF EXISTS "Allow first admin bootstrap" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles or check admin existence" ON public.user_roles;

-- Create new secure policies
-- Allow bootstrap only if no admin exists and user is creating their own admin role
CREATE POLICY "Allow first admin bootstrap"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  NOT admin_exists() 
  AND auth.uid() = user_id 
  AND role = 'admin'
);

-- Only existing admins can manage OTHER users' roles (prevents self-elevation)
CREATE POLICY "Only admins can manage other users roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_admin_not_self(auth.uid(), user_id))
WITH CHECK (is_admin_not_self(auth.uid(), user_id));

-- Users can view their own roles, admins can view all roles
CREATE POLICY "Users can view own roles, admins view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Prevent users from deleting their own roles if they're admin
CREATE POLICY "Prevent admin self-deletion"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  is_admin_not_self(auth.uid(), user_id)
  OR (user_id = auth.uid() AND role != 'admin')
);

-- Create audit log table for security events
CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_user_id uuid,
  old_role text,
  new_role text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log role changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, new_role
    ) VALUES (
      auth.uid(), 'ROLE_ASSIGNED', NEW.user_id, NEW.role::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, old_role, new_role
    ) VALUES (
      auth.uid(), 'ROLE_UPDATED', NEW.user_id, OLD.role::text, NEW.role::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_audit_log (
      user_id, action, target_user_id, old_role
    ) VALUES (
      auth.uid(), 'ROLE_REMOVED', OLD.user_id, OLD.role::text
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for audit logging
CREATE TRIGGER audit_user_role_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_changes();
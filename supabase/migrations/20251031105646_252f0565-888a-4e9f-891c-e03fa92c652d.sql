-- Grant HR full access permissions to all admin users
INSERT INTO hr_permissions (user_id, permission_type)
SELECT ur.user_id, 'full_access'::hr_permission_type
FROM user_roles ur
WHERE ur.role = 'admin'::app_role
ON CONFLICT (user_id, permission_type) DO NOTHING;

-- Ensure the RLS policies work correctly
-- Drop and recreate policies for better clarity
DROP POLICY IF EXISTS "Apenas admins e RH Full podem inserir funcionários" ON employees;
DROP POLICY IF EXISTS "Usuários com permissão RH veem funcionários" ON employees;
DROP POLICY IF EXISTS "Apenas admins e RH Full podem atualizar funcionários" ON employees;

-- Policy for SELECT (viewing employees)
CREATE POLICY "Admins and HR can view employees" 
ON employees FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
  OR has_hr_permission(auth.uid(), 'view_basic_info'::hr_permission_type)
);

-- Policy for INSERT (creating employees)
CREATE POLICY "Admins and HR full access can create employees" 
ON employees FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
);

-- Policy for UPDATE (editing employees)
CREATE POLICY "Admins and HR full access can update employees" 
ON employees FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_hr_permission(auth.uid(), 'full_access'::hr_permission_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees(full_name);
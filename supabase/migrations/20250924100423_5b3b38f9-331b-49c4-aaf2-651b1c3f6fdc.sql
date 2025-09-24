-- Security Enhancement: PII Data Masking and Access Control

-- 1. Create table for salary information with restricted access
CREATE TABLE public.employee_salary_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS on salary table
ALTER TABLE public.employee_salary_info ENABLE ROW LEVEL SECURITY;

-- 2. Create security functions for PII masking
CREATE OR REPLACE FUNCTION public.mask_cpf(cpf_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF cpf_value IS NULL OR LENGTH(cpf_value) < 4 THEN
    RETURN cpf_value;
  END IF;
  RETURN '***.***.***-' || RIGHT(cpf_value, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.mask_rg(rg_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF rg_value IS NULL OR LENGTH(rg_value) < 4 THEN
    RETURN rg_value;
  END IF;
  RETURN '****' || RIGHT(rg_value, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Create masked view for employee data
CREATE VIEW public.employees_masked AS
SELECT 
  e.*,
  CASE 
    WHEN has_role(auth.uid(), 'admin') THEN e.cpf
    ELSE mask_cpf(e.cpf)
  END AS cpf_display,
  CASE 
    WHEN has_role(auth.uid(), 'admin') THEN e.rg
    ELSE mask_rg(e.rg)
  END AS rg_display,
  s.salary as salary_amount
FROM public.employees e
LEFT JOIN public.employee_salary_info s ON e.id = s.employee_id;

-- 4. Create RLS policies for salary table
CREATE POLICY "Only admins can view salary info"
ON public.employee_salary_info
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage salary info"
ON public.employee_salary_info
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5. Enhanced audit logging function for PII access
CREATE OR REPLACE FUNCTION public.log_pii_access(
  p_table_name TEXT,
  p_employee_id UUID,
  p_access_type TEXT,
  p_pii_fields TEXT[]
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    'PII_ACCESS',
    p_table_name,
    p_employee_id,
    jsonb_build_object(
      'access_type', p_access_type,
      'pii_fields', p_pii_fields,
      'timestamp', now(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to migrate existing salary data
DO $$
DECLARE
  emp_record RECORD;
BEGIN
  FOR emp_record IN 
    SELECT id, salary FROM public.employees WHERE salary IS NOT NULL
  LOOP
    INSERT INTO public.employee_salary_info (employee_id, salary)
    VALUES (emp_record.id, emp_record.salary)
    ON CONFLICT (employee_id) DO UPDATE SET salary = emp_record.salary;
  END LOOP;
END $$;

-- 7. Create trigger to keep salary data in sync
CREATE OR REPLACE FUNCTION public.sync_employee_salary()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update or insert salary info
    INSERT INTO public.employee_salary_info (employee_id, salary)
    VALUES (NEW.id, NEW.salary)
    ON CONFLICT (employee_id) 
    DO UPDATE SET 
      salary = NEW.salary,
      updated_at = now();
    
    -- Log PII access if salary was accessed
    IF NEW.salary IS NOT NULL THEN
      PERFORM log_pii_access('employees', NEW.id, 'SALARY_UPDATE', ARRAY['salary']);
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.employee_salary_info WHERE employee_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_employee_salary_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_salary();

-- 8. Update triggers for automatic timestamp updates on salary table
CREATE TRIGGER update_employee_salary_info_updated_at
  BEFORE UPDATE ON public.employee_salary_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
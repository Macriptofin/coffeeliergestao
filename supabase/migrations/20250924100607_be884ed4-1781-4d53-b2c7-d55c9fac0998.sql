-- Fix security linter issues from previous migration (fixed reserved keyword issue)

-- 1. Fix function search_path issues
CREATE OR REPLACE FUNCTION public.mask_cpf(cpf_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF cpf_value IS NULL OR LENGTH(cpf_value) < 4 THEN
    RETURN cpf_value;
  END IF;
  RETURN '***.***.***-' || RIGHT(cpf_value, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.mask_rg(rg_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF rg_value IS NULL OR LENGTH(rg_value) < 4 THEN
    RETURN rg_value;
  END IF;
  RETURN '****' || RIGHT(rg_value, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Replace the security definer view with a function-based approach
DROP VIEW IF EXISTS public.employees_masked;

-- Create a secure function to get masked employee data instead of a view
CREATE OR REPLACE FUNCTION public.get_masked_employee_data()
RETURNS TABLE (
  id UUID,
  employee_number TEXT,
  full_name TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  gender TEXT,
  marital_status TEXT,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  department TEXT,
  "position" TEXT,
  hire_date DATE,
  termination_date DATE,
  employment_type TEXT,
  benefits TEXT[],
  pis_pasep TEXT,
  ctps_number TEXT,
  ctps_series TEXT,
  voter_registration TEXT,
  military_service TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account TEXT,
  account_type TEXT,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  cpf_display TEXT,
  rg_display TEXT,
  salary_amount NUMERIC
) AS $$
BEGIN
  -- Log PII access
  PERFORM log_pii_access('employees', NULL, 'LIST_VIEW', ARRAY['cpf', 'rg', 'salary']);
  
  RETURN QUERY
  SELECT 
    e.id,
    e.employee_number,
    e.full_name,
    e.cpf,
    e.rg,
    e.birth_date,
    e.gender,
    e.marital_status,
    e.email,
    e.phone,
    e.mobile_phone,
    e.emergency_contact_name,
    e.emergency_contact_phone,
    e.address,
    e.city,
    e.state,
    e.zip_code,
    e.department,
    e."position",
    e.hire_date,
    e.termination_date,
    e.employment_type,
    e.benefits,
    e.pis_pasep,
    e.ctps_number,
    e.ctps_series,
    e.voter_registration,
    e.military_service,
    e.bank_name,
    e.bank_branch,
    e.bank_account,
    e.account_type,
    e.status,
    e.notes,
    e.created_at,
    e.updated_at,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN e.cpf
      ELSE mask_cpf(e.cpf)
    END AS cpf_display,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN e.rg
      ELSE mask_rg(e.rg)
    END AS rg_display,
    CASE 
      WHEN has_role(auth.uid(), 'admin') THEN s.salary
      ELSE NULL
    END AS salary_amount
  FROM public.employees e
  LEFT JOIN public.employee_salary_info s ON e.id = s.employee_id
  WHERE is_admin_or_manager(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
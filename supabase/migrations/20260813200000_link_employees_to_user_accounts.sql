ALTER TABLE public.employees
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);

COMMENT ON COLUMN public.employees.user_id IS
  'Vínculo opcional com a conta de login (auth.users) deste funcionário. NULL = funcionário sem acesso ao sistema.';

DROP FUNCTION public.get_masked_employee_data();

CREATE FUNCTION public.get_masked_employee_data()
 RETURNS TABLE(id uuid, employee_number text, full_name text, cpf text, rg text, birth_date date, gender text, marital_status text, email text, phone text, mobile_phone text, emergency_contact_name text, emergency_contact_phone text, address text, city text, state text, zip_code text, department text, "position" text, hire_date date, termination_date date, employment_type text, benefits text[], pis_pasep text, ctps_number text, ctps_series text, voter_registration text, military_service text, bank_name text, bank_branch text, bank_account text, account_type text, status text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, cpf_display text, rg_display text, salary_amount numeric, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    END AS salary_amount,
    e.user_id
  FROM public.employees e
  LEFT JOIN public.employee_salary_info s ON e.id = s.employee_id
  WHERE is_admin_or_manager(auth.uid());
END;
$function$;

-- Reendurecer contra EXECUTE por anon (Supabase concede por padrão em CREATE
-- OR REPLACE/DROP+CREATE — mesma armadilha já documentada em outras funções).
REVOKE EXECUTE ON FUNCTION public.get_masked_employee_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_masked_employee_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_masked_employee_data() TO authenticated;

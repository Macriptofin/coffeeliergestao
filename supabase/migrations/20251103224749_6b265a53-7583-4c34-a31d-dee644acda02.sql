-- Remove faulty salary sync trigger that references a non-existent column NEW.salary on employees
-- This trigger causes: "record new has no field 'salary'"

-- 1) Drop trigger if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'sync_employee_salary_trigger'
      AND c.relname = 'employees'
  ) THEN
    EXECUTE 'DROP TRIGGER sync_employee_salary_trigger ON public.employees';
  END IF;
END $$;

-- 2) Drop function if it exists (no longer needed; salary handled via employee_salary_info separately in app logic)
DROP FUNCTION IF EXISTS public.sync_employee_salary() CASCADE;
-- Adicionar triggers para monitoramento automático de segurança
CREATE OR REPLACE FUNCTION public.trigger_security_monitoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Monitorar exclusões de funcionários
  IF TG_TABLE_NAME = 'employees' AND TG_OP = 'DELETE' THEN
    PERFORM public.create_security_alert(
      'EMPLOYEE_DELETION',
      'high',
      'Funcionário excluído',
      format('Funcionário %s foi excluído do sistema', OLD.full_name),
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      jsonb_build_object(
        'employee_id', OLD.id,
        'employee_name', OLD.full_name,
        'department', OLD.department
      )
    );
    RETURN OLD;
  END IF;

  -- Monitorar exclusões de clientes
  IF TG_TABLE_NAME = 'clients' AND TG_OP = 'DELETE' THEN
    PERFORM public.create_security_alert(
      'CLIENT_DELETION',
      'medium',
      'Cliente excluído',
      format('Cliente %s foi excluído do sistema', OLD.name),
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      jsonb_build_object(
        'client_id', OLD.id,
        'client_name', OLD.name
      )
    );
    RETURN OLD;
  END IF;

  -- Monitorar mudanças de role para admin
  IF TG_TABLE_NAME = 'user_roles' AND TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    PERFORM public.create_security_alert(
      'ADMIN_ROLE_GRANTED',
      'critical',
      'Permissão de administrador concedida',
      format('Role de administrador foi concedida ao usuário'),
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'granted_by', auth.uid()
      )
    );
    RETURN NEW;
  END IF;

  -- Monitorar acesso a dados financeiros sensíveis
  IF TG_TABLE_NAME = 'employee_salary_info' AND TG_OP = 'SELECT' THEN
    PERFORM public.create_security_alert(
      'SALARY_DATA_ACCESS',
      'medium',
      'Acesso a dados salariais',
      'Informações salariais foram acessadas',
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      jsonb_build_object(
        'employee_id', NEW.employee_id,
        'accessed_by', auth.uid()
      )
    );
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar triggers de segurança
DROP TRIGGER IF EXISTS security_monitor_employees ON public.employees;
CREATE TRIGGER security_monitor_employees
  BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.trigger_security_monitoring();

DROP TRIGGER IF EXISTS security_monitor_clients ON public.clients;
CREATE TRIGGER security_monitor_clients
  BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trigger_security_monitoring();

DROP TRIGGER IF EXISTS security_monitor_user_roles ON public.user_roles;
CREATE TRIGGER security_monitor_user_roles
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_security_monitoring();
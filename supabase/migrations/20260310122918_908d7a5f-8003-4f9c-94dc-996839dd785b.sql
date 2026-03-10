
-- CORREÇÃO CRÍTICA: a FK security_audit_log_user_id_fkey usa ON DELETE NO ACTION (padrão),
-- o que impede deletar usuários que tenham registros nessa tabela.
-- Ajuste para SET NULL, preservando logs de auditoria mesmo sem o usuário.

ALTER TABLE public.security_audit_log 
  DROP CONSTRAINT security_audit_log_user_id_fkey;

ALTER TABLE public.security_audit_log 
  ADD CONSTRAINT security_audit_log_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- Correção para security_alerts (user_id com ON DELETE NO ACTION também)
ALTER TABLE public.security_alerts 
  DROP CONSTRAINT IF EXISTS security_alerts_user_id_fkey;

ALTER TABLE public.security_alerts 
  ADD CONSTRAINT security_alerts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- pii_access_log também tem ON DELETE NO ACTION
ALTER TABLE public.pii_access_log 
  DROP CONSTRAINT IF EXISTS pii_access_log_user_id_fkey;

ALTER TABLE public.pii_access_log 
  ADD CONSTRAINT pii_access_log_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

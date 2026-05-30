-- =====================================================
-- FASE 5: Sistema de Permissões por Módulo
-- Data: 2026-05-30
-- Abordagem aditiva — mantém tabelas existentes
-- =====================================================

CREATE TABLE IF NOT EXISTS module_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  module     text NOT NULL,
  action     text NOT NULL,
  scope      text DEFAULT 'all',
  granted_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module, action)
);

ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own"     ON module_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_manage_all" ON module_permissions FOR ALL   USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','manager'))
);

CREATE INDEX IF NOT EXISTS idx_module_permissions_user   ON module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_module ON module_permissions(module);

CREATE TABLE IF NOT EXISTS role_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]',
  is_system   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_templates" ON role_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admins_manage_templates"      ON role_templates FOR ALL    USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
);

CREATE OR REPLACE FUNCTION check_module_permission(p_user_id uuid, p_module text, p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles   WHERE user_id = p_user_id AND role::text IN ('admin','manager'))
      OR EXISTS (SELECT 1 FROM module_permissions WHERE user_id = p_user_id AND module = p_module AND action = p_action);
$$;

-- Migrar hr_permissions
INSERT INTO module_permissions (user_id, module, action, granted_by)
SELECT user_id, 'rh', permission_type::text, granted_by FROM hr_permissions
ON CONFLICT (user_id, module, action) DO NOTHING;

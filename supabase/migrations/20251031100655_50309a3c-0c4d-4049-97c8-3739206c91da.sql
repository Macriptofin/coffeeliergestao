-- Criar tabela de jornadas de trabalho
CREATE TABLE work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  work_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lunch_start TIME,
  lunch_end TIME,
  total_hours NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna de jornada aos funcionários
ALTER TABLE employees ADD COLUMN work_schedule_id UUID REFERENCES work_schedules(id);

-- Criar tabela de registros de ponto
CREATE TABLE time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('entry', 'exit', 'lunch_start', 'lunch_end')),
  location_lat NUMERIC,
  location_lng NUMERIC,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_time_records_employee ON time_records(employee_id);
CREATE INDEX idx_time_records_date ON time_records(record_date);
CREATE INDEX idx_time_records_employee_date ON time_records(employee_id, record_date);
CREATE INDEX idx_employees_work_schedule ON employees(work_schedule_id);

-- Habilitar RLS
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;

-- Policies para work_schedules
CREATE POLICY "Admins e RH Full podem gerenciar jornadas"
ON work_schedules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_hr_permission(auth.uid(), 'full_access'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_hr_permission(auth.uid(), 'full_access'));

CREATE POLICY "Todos autenticados podem ver jornadas"
ON work_schedules FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Policies para time_records
CREATE POLICY "Admins e RH podem ver registros de ponto"
ON time_records FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_hr_permission(auth.uid(), 'full_access') OR 
  has_hr_permission(auth.uid(), 'view_basic_info')
);

CREATE POLICY "Admins e RH Full podem inserir registros"
ON time_records FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_hr_permission(auth.uid(), 'full_access'));

CREATE POLICY "Admins e RH Full podem atualizar registros"
ON time_records FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_hr_permission(auth.uid(), 'full_access'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_hr_permission(auth.uid(), 'full_access'));

CREATE POLICY "Apenas admins podem deletar registros"
ON time_records FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Triggers para atualizar updated_at
CREATE TRIGGER update_work_schedules_updated_at
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_records_updated_at
  BEFORE UPDATE ON time_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir jornada padrão
INSERT INTO work_schedules (name, description, work_days, start_time, end_time, lunch_start, lunch_end, total_hours)
VALUES 
  ('Jornada Padrão 8h', 'Segunda a Sexta, 8h às 17h com 1h de almoço', ARRAY[1,2,3,4,5], '08:00', '17:00', '12:00', '13:00', 8),
  ('Jornada 6h', 'Segunda a Sábado, 6h diárias', ARRAY[1,2,3,4,5,6], '08:00', '14:00', NULL, NULL, 6);
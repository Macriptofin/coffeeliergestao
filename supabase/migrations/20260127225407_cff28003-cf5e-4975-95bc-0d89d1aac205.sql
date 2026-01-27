-- =====================================================
-- MÓDULO DE CADASTRO DE CLIENTES CORPORATIVOS
-- =====================================================

-- 1. TABELA: client_departments (Áreas/Departamentos)
CREATE TABLE public.client_departments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, name)
);

-- 2. TABELA: client_units (Unidades/Prédios)
CREATE TABLE public.client_units (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, name)
);

-- 3. TABELA: client_rooms (Salas/Espaços)
CREATE TABLE public.client_rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.client_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    floor TEXT,
    capacity INTEGER,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(unit_id, name)
);

-- 4. TABELA: client_contacts (Usuários Solicitantes)
CREATE TABLE public.client_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.client_departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. ADICIONAR COLUNAS EM proposals
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.client_departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.client_units(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.client_rooms(id) ON DELETE SET NULL;

-- 6. ADICIONAR COLUNAS EM event_tables
ALTER TABLE public.event_tables
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.client_departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.client_units(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.client_rooms(id) ON DELETE SET NULL;

-- 7. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_client_departments_client_id ON public.client_departments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_units_client_id ON public.client_units(client_id);
CREATE INDEX IF NOT EXISTS idx_client_rooms_unit_id ON public.client_rooms(unit_id);
CREATE INDEX IF NOT EXISTS idx_client_rooms_client_id ON public.client_rooms(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_department_id ON public.client_contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_proposals_department_id ON public.proposals(department_id);
CREATE INDEX IF NOT EXISTS idx_proposals_contact_id ON public.proposals(contact_id);
CREATE INDEX IF NOT EXISTS idx_proposals_unit_id ON public.proposals(unit_id);
CREATE INDEX IF NOT EXISTS idx_proposals_room_id ON public.proposals(room_id);
CREATE INDEX IF NOT EXISTS idx_event_tables_unit_id ON public.event_tables(unit_id);
CREATE INDEX IF NOT EXISTS idx_event_tables_room_id ON public.event_tables(room_id);

-- 8. HABILITAR RLS
ALTER TABLE public.client_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- 9. POLÍTICAS RLS - client_departments
CREATE POLICY "Authenticated users can view client departments"
ON public.client_departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client departments"
ON public.client_departments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client departments"
ON public.client_departments FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client departments"
ON public.client_departments FOR DELETE
TO authenticated
USING (true);

-- 10. POLÍTICAS RLS - client_units
CREATE POLICY "Authenticated users can view client units"
ON public.client_units FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client units"
ON public.client_units FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client units"
ON public.client_units FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client units"
ON public.client_units FOR DELETE
TO authenticated
USING (true);

-- 11. POLÍTICAS RLS - client_rooms
CREATE POLICY "Authenticated users can view client rooms"
ON public.client_rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client rooms"
ON public.client_rooms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client rooms"
ON public.client_rooms FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client rooms"
ON public.client_rooms FOR DELETE
TO authenticated
USING (true);

-- 12. POLÍTICAS RLS - client_contacts
CREATE POLICY "Authenticated users can view client contacts"
ON public.client_contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client contacts"
ON public.client_contacts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client contacts"
ON public.client_contacts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client contacts"
ON public.client_contacts FOR DELETE
TO authenticated
USING (true);

-- 13. TRIGGER PARA UPDATED_AT
CREATE TRIGGER update_client_departments_updated_at
BEFORE UPDATE ON public.client_departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_units_updated_at
BEFORE UPDATE ON public.client_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_rooms_updated_at
BEFORE UPDATE ON public.client_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
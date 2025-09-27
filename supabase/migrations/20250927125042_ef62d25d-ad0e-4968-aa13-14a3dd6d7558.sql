-- Criação das tabelas do módulo Mesas/Eventos
-- (apenas se não existirem)

-- Perfis de Consumo
CREATE TABLE IF NOT EXISTS public.consumption_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grams_per_person numeric(10,2) NOT NULL DEFAULT 200,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Mix dos Perfis de Consumo
CREATE TABLE IF NOT EXISTS public.consumption_profile_mix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.consumption_profiles(id) ON DELETE CASCADE,
  category_label text NOT NULL,
  percent numeric(6,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, category_label)
);

-- Templates de Mesas
CREATE TABLE IF NOT EXISTS public.event_table_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_profile_id uuid REFERENCES public.consumption_profiles(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Itens dos Templates
CREATE TABLE IF NOT EXISTS public.event_table_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.event_table_templates(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  category_label text NOT NULL,
  quantity_per_person numeric(14,6),
  fixed_quantity numeric(14,6),
  unit_override text,
  position integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Mesas/Eventos
CREATE TABLE IF NOT EXISTS public.event_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  client_name text NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  date_start timestamp with time zone NOT NULL,
  date_end timestamp with time zone,
  attendees integer NOT NULL CHECK (attendees > 0),
  profile_id uuid REFERENCES public.consumption_profiles(id),
  template_id uuid REFERENCES public.event_table_templates(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','proposed','approved','producing','done','canceled')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Itens das Mesas
CREATE TABLE IF NOT EXISTS public.event_table_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_table_id uuid NOT NULL REFERENCES public.event_tables(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  category_label text NOT NULL,
  quantity_per_person numeric(14,6),
  fixed_quantity numeric(14,6),
  unit_override text,
  position integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('from_template','manual')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_table_id, material_id)
);

-- Ordens de Produção de Eventos
CREATE TABLE IF NOT EXISTS public.event_production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_table_id uuid NOT NULL REFERENCES public.event_tables(id),
  order_code text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','done','canceled')),
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Itens das Ordens de Produção
CREATE TABLE IF NOT EXISTS public.event_production_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.event_production_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  planned_qty numeric(14,6) NOT NULL,
  planned_unit text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('produce_finished','pick_resale','pick_finished','packaging_only')),
  position integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_event_table_items_event_table_id ON public.event_table_items(event_table_id);
CREATE INDEX IF NOT EXISTS idx_event_table_items_material_id ON public.event_table_items(material_id);
CREATE INDEX IF NOT EXISTS idx_event_table_template_items_template_id ON public.event_table_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_event_table_template_items_material_id ON public.event_table_template_items(material_id);
CREATE INDEX IF NOT EXISTS idx_event_tables_client_id ON public.event_tables(client_id);
CREATE INDEX IF NOT EXISTS idx_event_tables_date_start ON public.event_tables(date_start);
CREATE INDEX IF NOT EXISTS idx_event_tables_status ON public.event_tables(status);
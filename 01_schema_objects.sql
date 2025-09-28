-- =====================================
-- SCHEMA OBJECTS - DDL COMPLETO
-- Sistema Coffeelier ERP - Supabase
-- =====================================

-- EXTENSÕES ATIVAS
-- pgcrypto (v1.3) - cryptographic functions
-- plpgsql (v1.0) - PL/pgSQL procedural language  
-- supabase_vault (v0.3.1) - Supabase Vault Extension
-- pg_stat_statements (v1.11) - track planning and execution statistics
-- uuid-ossp (v1.1) - generate universally unique identifiers (UUIDs)
-- pg_graphql (v1.5.11) - GraphQL support

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'financial', 'user');
CREATE TYPE public.event_category AS ENUM ('coffee_break', 'coquetel', 'almoco', 'jantar', 'lanche', 'outros');
CREATE TYPE public.permission_category AS ENUM ('materials', 'production', 'sales', 'finance', 'inventory', 'reports', 'events', 'users');
CREATE TYPE public.permission_subcategory AS ENUM ('view', 'create', 'edit', 'delete', 'approve', 'export');
CREATE TYPE public.product_category AS ENUM ('salgados', 'doces', 'bebidas', 'outros');

-- =====================================
-- PRINCIPAIS TABELAS DE NEGÓCIO
-- =====================================

-- MATERIALS (núcleo do sistema)
-- Gestão unificada de materiais: insumos, embalagens, produtos intermediários, acabados e compostos
CREATE TABLE public.materials (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'Insumo'::text,
    subcategory text,
    category_term_id uuid, -- FK para taxonomy_terms
    subcategory_term_id uuid, -- FK para taxonomy_terms  
    material_type text NOT NULL DEFAULT 'ingredient'::text,
    purchase_unit text NOT NULL,
    usage_unit text NOT NULL,
    conversion_factor numeric NOT NULL DEFAULT 1,
    price_per_purchase_unit numeric NOT NULL,
    unit_weight numeric,
    supplier text,
    supplier_id uuid, -- FK para suppliers
    allowed_brands text[],
    is_sellable boolean DEFAULT false,
    is_system_generated boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- STOCK_ITEMS (controle de estoque)
CREATE TABLE public.stock_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id uuid NOT NULL UNIQUE, -- FK para materials
    current_quantity numeric NOT NULL DEFAULT 0,
    minimum_quantity numeric DEFAULT 0,
    average_price numeric DEFAULT 0,
    total_value numeric DEFAULT 0,
    last_movement_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- STOCK_MOVEMENTS (movimentações de estoque)
CREATE TABLE public.stock_movements (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id uuid NOT NULL, -- FK para materials
    movement_type text NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric,
    total_value numeric,
    movement_date date DEFAULT CURRENT_DATE,
    movement_time time DEFAULT CURRENT_TIME,
    reference_type text,
    reference_id uuid,
    supplier_id uuid, -- FK para suppliers
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- =====================================
-- BOM (BILL OF MATERIALS) - SISTEMA UNIFICADO
-- =====================================

-- RECIPES_BOM (receitas de produtos acabados/intermediários)
CREATE TABLE public.recipes_bom (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    finished_material_id uuid NOT NULL UNIQUE, -- FK para materials
    yield_quantity numeric DEFAULT 1,
    yield_unit text DEFAULT 'un',
    waste_percent numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RECIPE_BOM_ITEMS (itens das receitas)
CREATE TABLE public.recipe_bom_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id uuid NOT NULL, -- FK para recipes_bom
    material_id uuid NOT NULL, -- FK para materials
    quantity numeric NOT NULL,
    unit text NOT NULL,
    position integer DEFAULT 1,
    is_packaging boolean DEFAULT false,
    UNIQUE(recipe_id, material_id)
);

-- COMPOSITES_BOM (produtos compostos - kits, cestas)
CREATE TABLE public.composites_bom (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    composite_material_id uuid NOT NULL UNIQUE, -- FK para materials
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- COMPOSITE_BOM_ITEMS (itens dos compostos)
CREATE TABLE public.composite_bom_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    composite_id uuid NOT NULL, -- FK para composites_bom
    component_material_id uuid NOT NULL, -- FK para materials
    quantity numeric NOT NULL,
    unit text NOT NULL,
    position integer DEFAULT 1,
    UNIQUE(composite_id, component_material_id)
);

-- =====================================
-- SISTEMA DE TAXONOMIAS
-- =====================================

-- TAXONOMY_DEFINITIONS (definições das taxonomias)
CREATE TABLE public.taxonomy_definitions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    is_hierarchical boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- TAXONOMY_TERMS (termos das taxonomias)
CREATE TABLE public.taxonomy_terms (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    taxonomy_id uuid NOT NULL, -- FK para taxonomy_definitions
    parent_id uuid, -- FK para taxonomy_terms (auto-referência)
    code text,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================
-- CENTRO DE CONFIGURAÇÕES
-- =====================================

-- CONFIG_NAMESPACES (namespaces de configuração)
CREATE TABLE public.config_namespaces (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- CONFIG_OPTIONS (opções de configuração)
CREATE TABLE public.config_options (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    namespace_id uuid NOT NULL, -- FK para config_namespaces
    key text NOT NULL,
    value_type text NOT NULL,
    default_value jsonb,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- CONFIG_VALUES (valores das configurações)
CREATE TABLE public.config_values (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    namespace_id uuid NOT NULL, -- FK para config_namespaces
    key text NOT NULL,
    value_jsonb jsonb NOT NULL,
    updated_by uuid, -- FK para auth.users
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(namespace_id, key)
);

-- =====================================
-- OUTRAS TABELAS PRINCIPAIS
-- =====================================

-- CLIENTS (clientes)
CREATE TABLE public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    cnpj_cpf text,
    email text,
    phone text,
    contact_person text,
    address text,
    city text,
    state text,
    zip_code text,
    status text NOT NULL DEFAULT 'Ativo'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- SUPPLIERS (fornecedores)
CREATE TABLE public.suppliers (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text UNIQUE,
    cnpj_cpf text,
    email text,
    phone text,
    contact_person text,
    address text,
    city text,
    state text,
    zip_code text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================
-- APP_SETTINGS (feature flags e configurações gerais)
-- =====================================

CREATE TABLE public.app_settings (
    key text NOT NULL PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================
-- PRINCIPAIS ÍNDICES CRÍTICOS
-- =====================================

-- Materiais
CREATE INDEX idx_materials_category_subcategory ON materials(category, subcategory);
CREATE INDEX idx_materials_material_type ON materials(material_type);
CREATE INDEX idx_materials_category_term ON materials(category_term_id) WHERE category_term_id IS NOT NULL;
CREATE INDEX idx_materials_subcategory_term ON materials(subcategory_term_id) WHERE subcategory_term_id IS NOT NULL;
CREATE INDEX idx_materials_is_sellable ON materials(is_sellable) WHERE is_sellable IS NOT NULL;

-- Estoque
CREATE INDEX idx_stock_items_material ON stock_items(material_id);
CREATE INDEX idx_stock_movements_material_date ON stock_movements(material_id, movement_date);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- BOM
CREATE INDEX idx_recipe_bom_items_recipe ON recipe_bom_items(recipe_id);
CREATE INDEX idx_recipe_bom_items_material ON recipe_bom_items(material_id);
CREATE INDEX idx_composite_bom_items_composite ON composite_bom_items(composite_id);
CREATE INDEX idx_composite_bom_items_material ON composite_bom_items(component_material_id);

-- Taxonomias
CREATE INDEX idx_taxonomy_terms_taxonomy ON taxonomy_terms(taxonomy_id);
CREATE INDEX idx_taxonomy_terms_parent ON taxonomy_terms(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_taxonomy_terms_active ON taxonomy_terms(is_active) WHERE is_active = true;
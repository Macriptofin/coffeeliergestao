-- [Doc] Migração incremental: Sistema de Receitas (BOM) e Produtos Compostos - Parte 1: Tabelas Base
-- Implementação idempotente e não destrutiva

-- Convenções auxiliares (gatilho de updated_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Garante colunas essenciais em materials
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Check constraint comportamental para material_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'materials_material_type_ck'
  ) THEN
    ALTER TABLE materials
    ADD CONSTRAINT materials_material_type_ck
      CHECK (
        material_type IN (
          'ingredient',         -- insumo
          'packaging',          -- embalagem/descartável
          'finished_product',   -- produto com receita (BOM)
          'resale_product',     -- produto de revenda (sem receita)
          'composite_product'   -- kit/mesa (agrega outros materiais)
        )
      );
  END IF;
END$$;

-- Trigger de updated_at para materials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'materials_set_updated_at_trg'
  ) THEN
    CREATE TRIGGER materials_set_updated_at_trg
    BEFORE UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Tabelas de Receitas (BOM) para produtos acabados
CREATE TABLE IF NOT EXISTS recipes_bom (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_material_id uuid NOT NULL UNIQUE REFERENCES materials(id),
  yield_quantity       numeric(14,6) NOT NULL,
  yield_unit           text NOT NULL,        -- ex: g, ml, un
  waste_percent        numeric(5,2) NOT NULL DEFAULT 0, -- quebra total
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Itens da receita (componentes: insumos e/ou embalagens)
CREATE TABLE IF NOT EXISTS recipe_bom_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id      uuid NOT NULL REFERENCES recipes_bom(id) ON DELETE CASCADE,
  material_id    uuid NOT NULL REFERENCES materials(id),
  quantity       numeric(14,6) NOT NULL,
  unit           text NOT NULL,    -- unidade de uso
  waste_percent  numeric(5,2) NOT NULL DEFAULT 0,
  is_packaging   boolean NOT NULL DEFAULT false,
  position       int NOT NULL DEFAULT 1,
  UNIQUE (recipe_id, material_id)
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_recipe ON recipe_bom_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_bom_items_material ON recipe_bom_items(material_id);

-- Tabelas de Compostos (kits/mesas)
CREATE TABLE IF NOT EXISTS composites_bom (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_material_id uuid NOT NULL UNIQUE REFERENCES materials(id),
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Itens do composto: podem ser quaisquer materiais (preferir acabados/revenda)
CREATE TABLE IF NOT EXISTS composite_bom_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_id           uuid NOT NULL REFERENCES composites_bom(id) ON DELETE CASCADE,
  component_material_id  uuid NOT NULL REFERENCES materials(id),
  quantity               numeric(14,6) NOT NULL,
  unit                   text NOT NULL,
  position               int NOT NULL DEFAULT 1,
  UNIQUE (composite_id, component_material_id)
);

CREATE INDEX IF NOT EXISTS idx_composite_bom_items_composite ON composite_bom_items(composite_id);
CREATE INDEX IF NOT EXISTS idx_composite_bom_items_material  ON composite_bom_items(component_material_id);

-- Triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'recipes_bom_set_updated_at_trg'
  ) THEN
    CREATE TRIGGER recipes_bom_set_updated_at_trg
    BEFORE UPDATE ON recipes_bom
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'composites_bom_set_updated_at_trg'
  ) THEN
    CREATE TRIGGER composites_bom_set_updated_at_trg
    BEFORE UPDATE ON composites_bom
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;
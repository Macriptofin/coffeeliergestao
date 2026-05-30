-- =====================================================
-- FASE 2: Motor de Conversão Centralizado
-- Data: 2026-05-30
-- =====================================================

CREATE TABLE IF NOT EXISTS unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  factor numeric NOT NULL CHECK (factor > 0),
  category text NOT NULL,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_unit, to_unit)
);

ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON unit_conversions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write" ON unit_conversions FOR ALL USING (auth.role() = 'authenticated');

INSERT INTO unit_conversions (from_unit, to_unit, factor, category, notes) VALUES
  ('kg','g',1000,'peso','1 kg = 1000 g'),
  ('g','kg',0.001,'peso','1 g = 0.001 kg'),
  ('L','ml',1000,'volume','1 L = 1000 ml'),
  ('ml','L',0.001,'volume','1 ml = 0.001 L'),
  ('pacote_bisnaguinha','un',15,'embalagem','1 pacote = 15 unidades'),
  ('pacote_bisnaguinha','g',400,'embalagem','1 pacote = 400g'),
  ('un_bisnaguinha','g',26.67,'embalagem','1 bisnaguinha = 26.67g'),
  ('caixa','un',12,'embalagem','Caixa padrão = 12 unidades'),
  ('fardo','un',30,'embalagem','Fardo padrão = 30 unidades'),
  ('bandeja','un',10,'embalagem','Bandeja padrão = 10 unidades'),
  ('porcao','g',150,'unidade','Porção padrão = 150g')
ON CONFLICT (from_unit, to_unit) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_unit_conversions_from ON unit_conversions(from_unit);

CREATE OR REPLACE FUNCTION get_conversion_factor(p_from text, p_to text)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT factor FROM unit_conversions WHERE from_unit = p_from AND to_unit = p_to AND is_active = true LIMIT 1;
$$;

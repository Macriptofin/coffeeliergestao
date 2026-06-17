-- FASE 2 — Modelo de dados de precificação.
-- Hierarquia de margem/overhead: produto → categoria → global.
-- Preço sugerido = (custo_direto + overhead) / (1 − margem). Margem é sobre o PREÇO.

-- 1) Defaults globais (app_settings, key/value text). Começa em 40% (igual ao
--    comportamento atual) e overhead 0 (nada muda até ser configurado).
INSERT INTO public.app_settings (key, value) VALUES
  ('pricing.default_margin_pct',   '0.40'),
  ('pricing.default_overhead_pct', '0'),
  ('pricing.default_overhead_value','0')
ON CONFLICT (key) DO NOTHING;

-- 2) Override por categoria
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type        text NOT NULL DEFAULT 'category' CHECK (scope_type IN ('category')),
  term_id           uuid NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  target_margin_pct numeric,   -- null = herda global
  overhead_pct      numeric,   -- null = herda global
  overhead_value    numeric,   -- null = herda global
  updated_at        timestamptz DEFAULT now(),
  updated_by        uuid,
  UNIQUE (scope_type, term_id)
);
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pricing_rules_all ON public.pricing_rules;
CREATE POLICY pricing_rules_all ON public.pricing_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Override + cache por produto
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS target_margin_pct  numeric,   -- override de margem (null=herda)
  ADD COLUMN IF NOT EXISTS overhead_pct       numeric,   -- override overhead % (null=herda)
  ADD COLUMN IF NOT EXISTS overhead_value     numeric,   -- override overhead R$/un (null=herda)
  ADD COLUMN IF NOT EXISTS practiced_price    numeric,   -- preço praticado (manual)
  ADD COLUMN IF NOT EXISTS suggested_price    numeric,   -- preço sugerido (cache calculado)
  ADD COLUMN IF NOT EXISTS pricing_updated_at timestamptz;

-- 4) Helper: lê default global numérico
CREATE OR REPLACE FUNCTION public.pricing_global_default(p_key text, p_fallback numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT NULLIF(value,'')::numeric FROM public.app_settings WHERE key = p_key), p_fallback);
$$;

-- 5) Calculadora canônica — resolve hierarquia e devolve o detalhamento completo.
CREATE OR REPLACE FUNCTION public.compute_product_pricing(p_material_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  m record;
  v_cat_id uuid;
  v_rule_margin numeric; v_rule_oh_pct numeric; v_rule_oh_val numeric;
  v_direct numeric; v_margin numeric; v_margin_src text;
  v_oh_pct numeric; v_oh_val numeric; v_oh_amount numeric;
  v_total numeric; v_suggested numeric; v_effective numeric; v_realized numeric;
BEGIN
  SELECT id, category_term_id, cost_price, target_margin_pct, overhead_pct, overhead_value, practiced_price
    INTO m FROM public.materials WHERE id = p_material_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Custo direto: prioridade ficha (cached_unit_cost) > preço médio estoque > cost_price
  SELECT COALESCE(
           (SELECT rb.cached_unit_cost FROM public.recipes_bom rb
             WHERE rb.finished_material_id = p_material_id AND COALESCE(rb.is_archived,false)=false
             ORDER BY rb.cost_last_calculated_at DESC NULLS LAST LIMIT 1),
           (SELECT NULLIF(si.average_price,0) FROM public.stock_items si WHERE si.material_id = p_material_id),
           m.cost_price, 0)
    INTO v_direct;

  -- Regra de categoria (escalares; ficam NULL se não houver)
  v_cat_id := m.category_term_id;
  IF v_cat_id IS NOT NULL THEN
    SELECT target_margin_pct, overhead_pct, overhead_value
      INTO v_rule_margin, v_rule_oh_pct, v_rule_oh_val
      FROM public.pricing_rules
     WHERE scope_type='category' AND term_id = v_cat_id;
  END IF;

  -- Margem: produto → categoria → global
  IF m.target_margin_pct IS NOT NULL THEN
    v_margin := m.target_margin_pct; v_margin_src := 'produto';
  ELSIF v_rule_margin IS NOT NULL THEN
    v_margin := v_rule_margin; v_margin_src := 'categoria';
  ELSE
    v_margin := public.pricing_global_default('pricing.default_margin_pct', 0.40); v_margin_src := 'global';
  END IF;

  v_oh_pct := COALESCE(m.overhead_pct, v_rule_oh_pct,
                       public.pricing_global_default('pricing.default_overhead_pct', 0));
  v_oh_val := COALESCE(m.overhead_value, v_rule_oh_val,
                       public.pricing_global_default('pricing.default_overhead_value', 0));

  v_oh_amount := v_direct * COALESCE(v_oh_pct,0) + COALESCE(v_oh_val,0);
  v_total     := v_direct + v_oh_amount;

  -- Preço sugerido (margem sobre preço). NULL se margem inválida.
  v_suggested := CASE WHEN v_margin IS NOT NULL AND v_margin < 1
                      THEN round(v_total / (1 - v_margin), 2) ELSE NULL END;

  v_effective := COALESCE(m.practiced_price, v_suggested);
  v_realized  := CASE WHEN v_effective IS NOT NULL AND v_effective > 0
                      THEN round((v_effective - v_total) / v_effective, 4) ELSE NULL END;

  RETURN jsonb_build_object(
    'material_id',        p_material_id,
    'direct_cost',        round(v_direct,4),
    'overhead_pct',       v_oh_pct,
    'overhead_value',     v_oh_val,
    'overhead_amount',    round(v_oh_amount,4),
    'total_cost',         round(v_total,4),
    'margin_pct',         v_margin,
    'margin_source',      v_margin_src,
    'suggested_price',    v_suggested,
    'practiced_price',    m.practiced_price,
    'effective_price',    v_effective,
    'realized_margin_pct', v_realized
  );
END;
$$;

-- 6) Atualiza o cache suggested_price/pricing_updated_at do produto
CREATE OR REPLACE FUNCTION public.refresh_material_pricing(p_material_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  v := public.compute_product_pricing(p_material_id);
  IF v IS NULL THEN RETURN; END IF;
  UPDATE public.materials
     SET suggested_price = NULLIF(v->>'suggested_price','')::numeric,
         pricing_updated_at = now()
   WHERE id = p_material_id;
END;
$$;

-- 7) Trigger: recalcula o preço sugerido quando custo ou overrides de preço mudam.
--    SET de suggested_price/pricing_updated_at NÃO está nas colunas vigiadas → sem recursão.
CREATE OR REPLACE FUNCTION public.trg_material_pricing_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.refresh_material_pricing(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_material_pricing_refresh ON public.materials;
CREATE TRIGGER trg_material_pricing_refresh
AFTER INSERT OR UPDATE OF cost_price, target_margin_pct, overhead_pct, overhead_value
ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.trg_material_pricing_refresh();

-- 8) Recalcular preço sugerido em massa (usar após mudar global/categoria)
CREATE OR REPLACE FUNCTION public.recompute_all_pricing()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.materials LOOP
    PERFORM public.refresh_material_pricing(r.id);
  END LOOP;
END;
$$;

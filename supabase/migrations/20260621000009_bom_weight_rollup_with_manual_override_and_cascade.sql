-- ROLLUP DE PESO/VOLUME DA FICHA TÉCNICA (espelha a arquitetura do custo).
-- Conteúdo líquido por unidade de uso (g p/ comida, mL p/ bebida):
--  * massa (g/kg/mg) → quantidade em g; volume (mL/L) → quantidade em mL;
--  * unidade contável → quantidade × conteúdo unitário do componente (recursivo);
--  * override manual (recipes_bom.final_weight_manual) tem prioridade (perda por cocção/evaporação);
--  * por unidade = conteúdo total ÷ rendimento (yield_quantity).
-- Sem override → adota SEMPRE o somatório dos ingredientes (regra base).

ALTER TABLE public.recipes_bom
  ADD COLUMN IF NOT EXISTS cached_total_weight numeric,
  ADD COLUMN IF NOT EXISTS cached_unit_weight  numeric,
  ADD COLUMN IF NOT EXISTS final_weight_manual numeric;  -- conteúdo final do rendimento (override)

-- Conteúdo líquido de UMA unidade de uso do material (g ou mL), recursivo.
-- Robustez: unidade vazia do item cai na usage_unit do material.
CREATE OR REPLACE FUNCTION public.bom_unit_content(p_material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rb    record;
  v_item  record;
  v_total numeric := 0;
  v_u     text;
BEGIN
  SELECT id, yield_quantity, final_weight_manual
    INTO v_rb
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id AND COALESCE(is_archived,false) = false
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN COALESCE((SELECT unit_weight FROM public.materials WHERE id = p_material_id), 0);
  END IF;

  IF v_rb.final_weight_manual IS NOT NULL THEN
    RETURN v_rb.final_weight_manual / NULLIF(v_rb.yield_quantity, 0);
  END IF;

  FOR v_item IN
    SELECT rbi.material_id, rbi.quantity,
           lower(btrim(COALESCE(NULLIF(btrim(rbi.unit), ''), m.usage_unit, ''))) AS u
    FROM public.recipe_bom_items rbi
    JOIN public.materials m ON m.id = rbi.material_id
    WHERE rbi.recipe_id = v_rb.id
  LOOP
    v_u := v_item.u;
    IF v_u IN ('g','grama','gramas') THEN
      v_total := v_total + COALESCE(v_item.quantity,0);
    ELSIF v_u = 'kg' THEN
      v_total := v_total + COALESCE(v_item.quantity,0) * 1000;
    ELSIF v_u = 'mg' THEN
      v_total := v_total + COALESCE(v_item.quantity,0) / 1000;
    ELSIF v_u IN ('ml','mililitro','mililitros') THEN
      v_total := v_total + COALESCE(v_item.quantity,0);
    ELSIF v_u = 'l' THEN
      v_total := v_total + COALESCE(v_item.quantity,0) * 1000;
    ELSE
      v_total := v_total + COALESCE(v_item.quantity,0) * COALESCE(public.bom_unit_content(v_item.material_id), 0);
    END IF;
  END LOOP;

  RETURN v_total / NULLIF(v_rb.yield_quantity, 0);
END;
$function$;

-- Recalcula peso da ficha de um produto e sincroniza materials.unit_weight.
CREATE OR REPLACE FUNCTION public.refresh_bom_weight_for_material(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_unit  numeric;
  v_yield numeric;
BEGIN
  SELECT yield_quantity INTO v_yield
  FROM public.recipes_bom
  WHERE finished_material_id = p_material_id AND COALESCE(is_archived,false) = false
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  v_unit := public.bom_unit_content(p_material_id);

  UPDATE public.recipes_bom
     SET cached_unit_weight  = round(COALESCE(v_unit,0), 4),
         cached_total_weight = round(COALESCE(v_unit,0) * COALESCE(v_yield,0), 4)
   WHERE finished_material_id = p_material_id AND COALESCE(is_archived,false) = false;

  UPDATE public.materials
     SET unit_weight = round(COALESCE(v_unit,0), 4)
   WHERE id = p_material_id
     AND unit_weight IS DISTINCT FROM round(COALESCE(v_unit,0), 4);
END;
$function$;

-- Trigger: itens da ficha mudaram → recalcula o peso do produto da ficha.
CREATE OR REPLACE FUNCTION public.trg_bom_weight_on_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_mat uuid;
BEGIN
  SELECT finished_material_id INTO v_mat
  FROM public.recipes_bom WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  IF v_mat IS NOT NULL THEN PERFORM public.refresh_bom_weight_for_material(v_mat); END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bom_weight_on_items ON public.recipe_bom_items;
CREATE TRIGGER trg_bom_weight_on_items
AFTER INSERT OR UPDATE OR DELETE ON public.recipe_bom_items
FOR EACH ROW EXECUTE FUNCTION public.trg_bom_weight_on_items();

-- Trigger: override manual / rendimento mudou → recalcula.
CREATE OR REPLACE FUNCTION public.trg_bom_weight_on_recipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.refresh_bom_weight_for_material(NEW.finished_material_id);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bom_weight_on_recipe ON public.recipes_bom;
CREATE TRIGGER trg_bom_weight_on_recipe
AFTER UPDATE OF final_weight_manual, yield_quantity ON public.recipes_bom
FOR EACH ROW
WHEN (NEW.final_weight_manual IS DISTINCT FROM OLD.final_weight_manual
      OR NEW.yield_quantity IS DISTINCT FROM OLD.yield_quantity)
EXECUTE FUNCTION public.trg_bom_weight_on_recipe();

-- Trigger: peso de um insumo mudou → cascateia p/ os produtos que o usam.
CREATE OR REPLACE FUNCTION public.trg_cascade_weight_on_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_parent uuid;
BEGIN
  FOR v_parent IN
    SELECT DISTINCT rb.finished_material_id
    FROM public.recipe_bom_items rbi
    JOIN public.recipes_bom rb ON rb.id = rbi.recipe_id
    WHERE rbi.material_id = NEW.id AND COALESCE(rb.is_archived,false) = false
      AND rb.finished_material_id <> NEW.id
  LOOP
    PERFORM public.refresh_bom_weight_for_material(v_parent);
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cascade_weight_on_material ON public.materials;
CREATE TRIGGER trg_cascade_weight_on_material
AFTER UPDATE OF unit_weight ON public.materials
FOR EACH ROW
WHEN (NEW.unit_weight IS DISTINCT FROM OLD.unit_weight)
EXECUTE FUNCTION public.trg_cascade_weight_on_material();

-- Backfill: recalcula todos os produtos com ficha (folhas → pais via cascata).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT finished_material_id
    FROM public.recipes_bom WHERE COALESCE(is_archived,false) = false
  LOOP
    PERFORM public.refresh_bom_weight_for_material(r.finished_material_id);
  END LOOP;
END $$;

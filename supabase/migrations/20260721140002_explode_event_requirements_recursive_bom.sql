-- Itens produzidos sob demanda (ex.: sanduíche montado horas antes do evento,
-- estoque sempre zerado) não podem virar necessidade de COMPRA — só os insumos
-- comprados da ficha técnica deles podem. A função original só explodia UM nível
-- de recipes_bom: se um componente da ficha era ele mesmo intermediate_product/
-- finished_product (ficha em cascata), voltava como "compra isso" em vez de
-- continuar explodindo. Este helper recursivo corrige isso.
CREATE OR REPLACE FUNCTION public.explode_bom_to_purchasable(
  p_material_id uuid,
  p_quantity numeric,
  p_unit text,
  p_is_packaging boolean DEFAULT false,
  p_depth integer DEFAULT 0
)
RETURNS TABLE(
  material_id uuid,
  material_name text,
  planned_qty numeric,
  planned_unit text,
  source_kind text,
  material_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mat RECORD;
  recipe RECORD;
  component RECORD;
BEGIN
  IF p_depth > 10 THEN
    RETURN; -- guarda contra ficha em ciclo/profundidade anormal
  END IF;

  SELECT m.name, m.material_type INTO mat FROM public.materials m WHERE m.id = p_material_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF mat.material_type IN ('intermediate_product', 'finished_product') THEN
    SELECT rb.* INTO recipe
    FROM public.recipes_bom rb
    WHERE rb.finished_material_id = p_material_id AND rb.is_archived = false;

    IF FOUND AND recipe.yield_quantity > 0 THEN
      FOR component IN
        SELECT rbi.material_id AS comp_id, rbi.quantity, rbi.unit, rbi.is_packaging
        FROM public.recipe_bom_items rbi
        WHERE rbi.recipe_id = recipe.id
      LOOP
        RETURN QUERY
        SELECT * FROM public.explode_bom_to_purchasable(
          component.comp_id,
          (p_quantity / recipe.yield_quantity) * component.quantity,
          component.unit,
          component.is_packaging,
          p_depth + 1
        );
      END LOOP;
      RETURN;
    END IF;

    -- Produzido sem ficha cadastrada: não há como explodir, trata como pick
    -- (mesmo comportamento que a função original tinha pro caso sem receita).
    material_id := p_material_id;
    material_name := mat.name;
    planned_qty := p_quantity;
    planned_unit := p_unit;
    source_kind := 'pick_finished';
    material_type := mat.material_type;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Tipo comprável (folha da árvore): devolve.
  material_id := p_material_id;
  material_name := mat.name;
  planned_qty := p_quantity;
  planned_unit := p_unit;
  source_kind := CASE WHEN p_is_packaging THEN 'packaging_component' ELSE 'recipe_component' END;
  material_type := mat.material_type;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.explode_event_requirements(
  p_event_table_id uuid,
  p_explode_components boolean DEFAULT false
)
RETURNS TABLE(
  material_id uuid,
  material_name text,
  planned_qty numeric,
  planned_unit text,
  source_kind text,
  material_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
  mat RECORD;
BEGIN
  FOR item_record IN
    SELECT * FROM public.compute_event_item_planned_qty(p_event_table_id)
  LOOP
    SELECT mt.name, mt.material_type INTO mat
    FROM public.materials mt
    WHERE mt.id = item_record.material_id;

    IF p_explode_components = true AND mat.material_type = 'finished_product' THEN
      RETURN QUERY
      SELECT * FROM public.explode_bom_to_purchasable(
        item_record.material_id, item_record.planned_qty, item_record.planned_unit
      );
    ELSE
      material_id := item_record.material_id;
      material_name := mat.name;
      planned_qty := item_record.planned_qty;
      planned_unit := item_record.planned_unit;
      source_kind := CASE
        WHEN mat.material_type = 'finished_product' THEN 'produce_finished'
        WHEN mat.material_type = 'resale_product' THEN 'pick_resale'
        ELSE 'pick_finished'
      END;
      material_type := mat.material_type;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

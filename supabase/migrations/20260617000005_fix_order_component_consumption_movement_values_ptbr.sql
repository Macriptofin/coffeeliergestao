-- CAUSA RAIZ: process_order_component_consumption inseria em stock_movements com
-- movement_type='Saida' (sem acento) e reference_type='ProducaoOrdem' — ambos
-- violam as CHECK constraints PT-BR (exigem 'Saída' e 'Ordem de Produção').
-- A função é usada tanto pelo consumo de ingredientes (consume_materials_for_production)
-- quanto pela baixa de perdas (finalize_production_order). Só não estourava antes
-- porque as ordens testadas não tinham material reservado a consumir.
CREATE OR REPLACE FUNCTION public.process_order_component_consumption(p_material_id uuid, p_quantity numeric, p_unit text, p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Garantir existência de stock_items
  INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM public.materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Saída de estoque
  UPDATE public.stock_items
     SET current_quantity = GREATEST(0, current_quantity - p_quantity),
         last_movement_date = now(),
         updated_at = now()
   WHERE material_id = p_material_id;

  -- Registrar movimento padrão com referência à ordem BOM (valores PT-BR canônicos)
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes,
    movement_date
  ) VALUES (
    p_material_id,
    'Saída',
    p_quantity,
    'Ordem de Produção',
    p_production_order_id,
    CONCAT('Consumo para ordem de produção BOM: ', p_production_order_id),
    now()
  );
END;
$function$;

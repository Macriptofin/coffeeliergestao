-- FASE 1 (correção de raiz): valorar as saídas de produção (consumo de ingrediente
-- E baixa de perda) com o custo do item = quantidade × average_price atual.
-- Assim a perda vira DESPESA quantificada (rastreável no DRE) e o consumo de insumo
-- tem valor histórico. Como é movimento 'Saída', NÃO dispara média ponderada, então
-- NÃO altera o custo do produto — apenas registra o valor que saiu do estoque.
CREATE OR REPLACE FUNCTION public.process_order_component_consumption(p_material_id uuid, p_quantity numeric, p_unit text, p_production_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_avg numeric;
BEGIN
  -- Garantir existência de stock_items
  INSERT INTO public.stock_items (material_id, current_quantity, average_price, minimum_quantity, last_movement_date)
  SELECT p_material_id, 0, COALESCE(price_per_purchase_unit, 0), 0, now()
  FROM public.materials WHERE id = p_material_id
  ON CONFLICT (material_id) DO NOTHING;

  -- Custo do item para valorar a saída (preço médio do estoque; fallback no custo do material)
  SELECT COALESCE(NULLIF(si.average_price, 0), m.cost_price)
    INTO v_avg
  FROM public.materials m
  LEFT JOIN public.stock_items si ON si.material_id = m.id
  WHERE m.id = p_material_id;

  -- Saída de estoque
  UPDATE public.stock_items
     SET current_quantity = GREATEST(0, current_quantity - p_quantity),
         last_movement_date = now(),
         updated_at = now()
   WHERE material_id = p_material_id;

  -- Registrar movimento valorado (valores PT-BR canônicos). unit_price/total_cost
  -- servem ao DRE/CMV; por ser 'Saída', não recalculam custo do produto.
  INSERT INTO public.stock_movements (
    material_id,
    movement_type,
    quantity,
    unit_price,
    total_cost,
    reference_type,
    reference_id,
    notes,
    movement_date
  ) VALUES (
    p_material_id,
    'Saída',
    p_quantity,
    v_avg,
    CASE WHEN v_avg IS NOT NULL THEN p_quantity * v_avg ELSE NULL END,
    'Ordem de Produção',
    p_production_order_id,
    CONCAT('Consumo para ordem de produção BOM: ', p_production_order_id),
    now()
  );
END;
$function$;

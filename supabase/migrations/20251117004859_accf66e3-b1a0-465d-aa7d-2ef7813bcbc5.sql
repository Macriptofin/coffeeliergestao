-- Create missing helper to avoid runtime error during cost adjustments
CREATE OR REPLACE FUNCTION public.trigger_refresh_bom_costs_on_material_price_change(p_material_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder implementation: prevents errors when called by process_cost_adjustment
  -- TODO: Implement cascading BOM cost refresh if required by business rules
  PERFORM 1;
END;
$$;

COMMENT ON FUNCTION public.trigger_refresh_bom_costs_on_material_price_change(uuid) IS 'Placeholder to acknowledge material price change; safe no-op until full BOM cascade is implemented.';
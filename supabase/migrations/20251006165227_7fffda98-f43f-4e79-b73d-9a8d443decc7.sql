-- Trigger para auto-incrementar match_count em invoice_material_matches
CREATE OR REPLACE FUNCTION public.increment_material_match_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Incrementar match_count e atualizar last_matched_at
  NEW.match_count := OLD.match_count + 1;
  NEW.last_matched_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_material_match_conflict
  BEFORE UPDATE ON public.invoice_material_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_material_match_count();

-- Trigger para auto-incrementar match_count em invoice_supplier_matches
CREATE OR REPLACE FUNCTION public.increment_supplier_match_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Incrementar match_count e atualizar last_matched_at
  NEW.match_count := OLD.match_count + 1;
  NEW.last_matched_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_supplier_match_conflict
  BEFORE UPDATE ON public.invoice_supplier_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_supplier_match_count();
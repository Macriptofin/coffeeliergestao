-- Matriz tipo→comportamento imposta no BANCO (SAP-style: o tipo de material governa
-- a cadeia). is_sellable é DERIVADO do material_type — não depende de formulário nem
-- de flag de legado. Vendáveis = acabado / composto / revenda.
CREATE OR REPLACE FUNCTION public.enforce_is_sellable_from_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.is_sellable := NEW.material_type IN ('finished_product','composite_product','resale_product');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_is_sellable ON public.materials;
CREATE TRIGGER trg_enforce_is_sellable
BEFORE INSERT OR UPDATE OF material_type ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.enforce_is_sellable_from_type();

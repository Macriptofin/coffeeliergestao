-- Código de material passa a ser NEUTRO e sequencial (MAT#####), sem prefixo de tipo.
-- O tipo é classificado por material_type/type_term_id (matriz), não pelo código.
-- Código continua único e IMUTÁVEL após criado. Código antigo preservado em legacy_code.

-- 1) Preservar o código atual (histórico/auditoria)
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS legacy_code text;
UPDATE public.materials SET legacy_code = code WHERE legacy_code IS NULL;

-- 2) Renumerar todos para MAT##### (ordem estável por criação). Desabilita o gatilho
--    de recálculo de custo durante a renumeração (código não afeta custo).
ALTER TABLE public.materials DISABLE TRIGGER update_bom_costs_on_material_price_change;
UPDATE public.materials m
   SET code = 'MAT' || LPAD(s.rn::text, 5, '0')
  FROM (SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
          FROM public.materials) s
 WHERE m.id = s.id;
ALTER TABLE public.materials ENABLE TRIGGER update_bom_costs_on_material_price_change;

-- 3) Geração de código neutro para novos materiais (sequência global MAT#####)
CREATE OR REPLACE FUNCTION public.generate_material_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  next_number integer;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '^MAT([0-9]+)$') AS INTEGER)), 0) + 1
      INTO next_number
      FROM public.materials
     WHERE code ~ '^MAT[0-9]+$';
    NEW.code := 'MAT' || LPAD(next_number::text, 5, '0');
  END IF;

  -- Defaults de campos obrigatórios (mantidos do comportamento anterior)
  IF NEW.purchase_unit IS NULL THEN NEW.purchase_unit := 'un'; END IF;
  IF NEW.usage_unit IS NULL THEN NEW.usage_unit := NEW.purchase_unit; END IF;
  IF NEW.conversion_factor IS NULL THEN NEW.conversion_factor := 1; END IF;
  IF NEW.price_per_purchase_unit IS NULL THEN NEW.price_per_purchase_unit := 0; END IF;

  RETURN NEW;
END;
$function$;

-- 4) Remover o trigger duplicado de geração de código (mantém só o condicional)
DROP TRIGGER IF EXISTS materials_auto_code ON public.materials;

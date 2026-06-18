-- Precificação só faz sentido para tipos VENDÁVEIS (acabado/composto/revenda).
-- Insumos, intermediários, embalagem, equipamento, suprimento só têm CUSTO
-- (que sobe pela cascata da ficha). Para esses, suggested_price fica NULL.
CREATE OR REPLACE FUNCTION public.refresh_material_pricing(p_material_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb; v_type text;
BEGIN
  SELECT material_type INTO v_type FROM public.materials WHERE id = p_material_id;
  IF v_type IS NULL THEN RETURN; END IF;

  -- Tipos não-vendáveis: garantir suggested_price nulo e sair.
  IF v_type NOT IN ('finished_product','composite_product','resale_product') THEN
    UPDATE public.materials
       SET suggested_price = NULL, pricing_updated_at = now()
     WHERE id = p_material_id AND suggested_price IS NOT NULL;
    RETURN;
  END IF;

  v := public.compute_product_pricing(p_material_id);
  IF v IS NULL THEN RETURN; END IF;
  UPDATE public.materials
     SET suggested_price = NULLIF(v->>'suggested_price','')::numeric,
         pricing_updated_at = now()
   WHERE id = p_material_id;
END;
$$;

-- recompute em massa: só itera tipos vendáveis
CREATE OR REPLACE FUNCTION public.recompute_all_pricing()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.materials
            WHERE material_type IN ('finished_product','composite_product','resale_product') LOOP
    PERFORM public.refresh_material_pricing(r.id);
  END LOOP;
END;
$$;

-- Limpeza única: zera suggested_price de tipos não-vendáveis já calculados
UPDATE public.materials
   SET suggested_price = NULL
 WHERE material_type NOT IN ('finished_product','composite_product','resale_product')
   AND suggested_price IS NOT NULL;

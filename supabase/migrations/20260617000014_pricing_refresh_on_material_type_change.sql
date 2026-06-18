-- A visibilidade/cálculo de preço é função do TIPO do material. Ao re-tipar um
-- produto (ex.: intermediário → acabado, ou o inverso), o suggested_price precisa
-- ser recalculado/limpo automaticamente. O gatilho só vigiava custo/margem; agora
-- vigia também material_type. refresh_material_pricing já trata a regra:
-- vendável → calcula; não-vendável → zera.
DROP TRIGGER IF EXISTS trg_material_pricing_refresh ON public.materials;
CREATE TRIGGER trg_material_pricing_refresh
AFTER INSERT OR UPDATE OF material_type, cost_price, target_margin_pct, overhead_pct, overhead_value
ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.trg_material_pricing_refresh();

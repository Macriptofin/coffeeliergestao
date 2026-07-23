import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BOMInfo {
  hasBOM: boolean;
  /** Custo total da receita (todos os itens × qtd) */
  totalCost?: number;
  /** Custo por unidade produzida */
  unitCost?: number;
  /** Número de componentes */
  itemsCount?: number;
  /** Rendimento configurado na receita */
  yieldQuantity?: number;
  /** Unidade do rendimento */
  yieldUnit?: string;
  /** Status do cálculo: complete | partial | incomplete | unknown */
  costStatus?: string;
  /** Itens sem custo disponível */
  missingCostItems?: { material_id: string; material_name: string; quantity: number }[];
  /** Quando o custo foi recalculado pela última vez */
  costLastCalculatedAt?: string;
}

const NO_BOM: BOMInfo = { hasBOM: false };

async function fetchMaterialBOM(materialId: string, materialType: string): Promise<BOMInfo> {
  if (['finished_product', 'intermediate_product'].includes(materialType)) {
    // Todos os produtos produzidos usam recipes_bom
    const { data, error } = await supabase
      .from('recipes_bom')
      .select(`
        id,
        yield_quantity,
        yield_unit,
        cached_total_cost,
        cached_unit_cost,
        cost_status,
        missing_cost_items,
        cost_last_calculated_at,
        recipe_bom_items (
          id,
          material_id,
          quantity,
          unit,
          waste_percent,
          is_packaging
        )
      `)
      .eq('finished_material_id', materialId)
      .eq('is_archived', false)
      .maybeSingle();

    if (error) throw error;

    if (!data || data.recipe_bom_items.length === 0) return NO_BOM;

    // Se cached_unit_cost já está calculado, usar direto
    if (data.cached_unit_cost != null) {
      return {
        hasBOM: true,
        totalCost: data.cached_total_cost ?? undefined,
        unitCost: data.cached_unit_cost,
        itemsCount: data.recipe_bom_items.length,
        yieldQuantity: data.yield_quantity,
        yieldUnit: data.yield_unit,
        costStatus: data.cost_status ?? 'unknown',
        missingCostItems: (data.missing_cost_items as any) ?? [],
        costLastCalculatedAt: data.cost_last_calculated_at ?? undefined,
      };
    }

    // Fallback: calcular na hora buscando average_price dos itens
    const matIds = data.recipe_bom_items.map((i: any) => i.material_id);
    const [{ data: stocks }, { data: subBoms }] = await Promise.all([
      supabase
        .from('stock_items')
        .select('material_id, average_price')
        .in('material_id', matIds),
      supabase
        .from('recipes_bom')
        .select('finished_material_id, cached_total_cost, cached_unit_cost, yield_quantity')
        .in('finished_material_id', matIds)
        .eq('is_archived', false),
    ]);

    const stockMap = Object.fromEntries(
      (stocks || []).map(s => [s.material_id, s.average_price])
    );
    const subBomMap = Object.fromEntries(
      (subBoms || []).map(b => [b.finished_material_id, b])
    );

    let totalCost = 0;
    let hasIncomplete = false;

    for (const item of data.recipe_bom_items as any[]) {
      const stockPrice = stockMap[item.material_id];
      const subBom = subBomMap[item.material_id];
      const qtyWithWaste = item.quantity * (1 + (item.waste_percent || 0) / 100);

      if (stockPrice != null && stockPrice > 0) {
        totalCost += qtyWithWaste * stockPrice;
      } else if (subBom?.cached_unit_cost != null) {
        totalCost += qtyWithWaste * subBom.cached_unit_cost;
      } else if (subBom?.cached_total_cost != null && subBom.yield_quantity > 0) {
        totalCost += qtyWithWaste * (subBom.cached_total_cost / subBom.yield_quantity);
      } else {
        hasIncomplete = true;
      }
    }

    const unitCost = data.yield_quantity > 0 ? totalCost / data.yield_quantity : undefined;

    return {
      hasBOM: true,
      totalCost,
      unitCost,
      itemsCount: data.recipe_bom_items.length,
      yieldQuantity: data.yield_quantity,
      yieldUnit: data.yield_unit,
      costStatus: hasIncomplete ? 'incomplete' : 'complete',
      missingCostItems: (data.missing_cost_items as any) ?? [],
      costLastCalculatedAt: data.cost_last_calculated_at ?? undefined,
    };

  } else if (materialType === 'composite_product') {
    // composites_bom (sistema legado — manter compatibilidade)
    const { data, error } = await supabase
      .from('composites_bom')
      .select(`
        id,
        cached_total_cost,
        cost_status,
        missing_cost_items,
        cost_last_calculated_at,
        composite_bom_items (
          id, quantity, component_material_id, unit
        )
      `)
      .eq('composite_material_id', materialId)
      .eq('is_archived', false)
      .maybeSingle();

    if (error) throw error;

    if (!data || data.composite_bom_items.length === 0) return NO_BOM;

    const matIds = data.composite_bom_items.map((i: any) => i.component_material_id);
    const { data: stocks } = await supabase
      .from('stock_items')
      .select('material_id, average_price')
      .in('material_id', matIds);

    const stockMap = Object.fromEntries(
      (stocks || []).map(s => [s.material_id, s.average_price])
    );

    let totalCost = data.cached_total_cost ?? 0;
    if (!data.cached_total_cost) {
      for (const item of data.composite_bom_items as any[]) {
        const sp = stockMap[item.component_material_id];
        if (sp) totalCost += item.quantity * sp;
      }
    }

    return {
      hasBOM: true,
      totalCost,
      unitCost: totalCost, // composites não têm yield
      itemsCount: data.composite_bom_items.length,
      costStatus: (data.cost_status as string) ?? 'unknown',
      missingCostItems: (data.missing_cost_items as any) ?? [],
      costLastCalculatedAt: data.cost_last_calculated_at ?? undefined,
    };

  }

  // Insumos, embalagens etc. — não têm BOM
  return NO_BOM;
}

/**
 * Hook unificado para consultar a ficha técnica (BOM) de qualquer material produzido.
 *
 * Suporta: finished_product, intermediate_product, composite_product.
 *
 * Custo calculado em cascata:
 *   Insumo → stock_items.average_price (preço médio ponderado das compras)
 *   Intermediário → recipes_bom.cached_unit_cost (custo da ficha do intermediário)
 */
export const useMaterialBOM = (materialId: string, materialType: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['material-bom', materialId, materialType];

  const { data: bomInfo = NO_BOM, isPending } = useQuery({
    queryKey,
    queryFn: () => fetchMaterialBOM(materialId, materialType),
    enabled: !!materialId,
  });

  return {
    bomInfo,
    loading: !!materialId && isPending,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
};

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BOMInfo {
  hasBOM: boolean;
  cost?: number;
  itemsCount?: number;
  yieldQuantity?: number;
}

export const useMaterialBOM = (materialId: string, materialType: string) => {
  const [bomInfo, setBomInfo] = useState<BOMInfo>({ hasBOM: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!materialId) {
      setLoading(false);
      return;
    }
    
    checkBOM();
  }, [materialId, materialType]);

  const checkBOM = async () => {
    try {
      if (materialType === 'finished_product') {
        // Check recipes_bom table
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes_bom')
          .select(`
            id,
            yield_quantity,
            recipe_bom_items (
              id,
              quantity,
              material_id,
              materials (
                price_per_purchase_unit,
                conversion_factor
              )
            )
          `)
          .eq('finished_material_id', materialId)
          .maybeSingle();

        if (recipeError) throw recipeError;

        if (recipeData && recipeData.recipe_bom_items.length > 0) {
          // Calculate total cost
          let totalCost = 0;
          recipeData.recipe_bom_items.forEach((item: any) => {
            if (item.materials) {
              const unitCost = item.materials.price_per_purchase_unit / item.materials.conversion_factor;
              totalCost += unitCost * item.quantity;
            }
          });

          setBomInfo({
            hasBOM: true,
            cost: totalCost / (recipeData.yield_quantity || 1),
            itemsCount: recipeData.recipe_bom_items.length,
            yieldQuantity: recipeData.yield_quantity
          });
        } else {
          setBomInfo({ hasBOM: false });
        }
      } else if (materialType === 'composite_product') {
        // Check composites_bom table
        const { data: compositeData, error: compositeError } = await supabase
          .from('composites_bom')
          .select(`
            id,
            composite_bom_items (
              id,
              quantity,
              component_material_id,
              materials (
                price_per_purchase_unit,
                conversion_factor
              )
            )
          `)
          .eq('composite_material_id', materialId)
          .maybeSingle();

        if (compositeError) throw compositeError;

        if (compositeData && compositeData.composite_bom_items.length > 0) {
          // Calculate total cost
          let totalCost = 0;
          compositeData.composite_bom_items.forEach((item: any) => {
            if (item.materials) {
              const unitCost = item.materials.price_per_purchase_unit / item.materials.conversion_factor;
              totalCost += unitCost * item.quantity;
            }
          });

          setBomInfo({
            hasBOM: true,
            cost: totalCost,
            itemsCount: compositeData.composite_bom_items.length
          });
        } else {
          setBomInfo({ hasBOM: false });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar BOM:', error);
      setBomInfo({ hasBOM: false });
    } finally {
      setLoading(false);
    }
  };

  return { bomInfo, loading, refetch: checkBOM };
};
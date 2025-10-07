import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MaterialCost {
  material_id: string;
  material_name: string;
  unit_cost: number;
  quantity: number;
  unit: string;
  total_cost: number;
  cost_source: 'stock' | 'invoice' | 'cadastro' | 'bom' | 'zero';
}

interface BOMCostResult {
  success: boolean;
  total_cost: number;
  items: MaterialCost[];
  missing_cost_items: string[];
  cost_status: 'complete' | 'partial' | 'unknown';
}

interface AvailabilityCheck {
  available: boolean;
  missing_items: Array<{
    material_id: string;
    material_name: string;
    needed: number;
    available: number;
    missing: number;
    unit: string;
  }>;
}

export const useBOMCosting = () => {
  const [loading, setLoading] = useState(false);

  /**
   * Calcula custo de um material usando fallback hierárquico
   */
  const getMaterialCost = async (materialId: string): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('get_material_cost', {
        p_material_id: materialId
      });

      if (error) throw error;
      return data || 0;
    } catch (error: any) {
      console.error('Erro ao buscar custo do material:', error);
      return 0;
    }
  };

  /**
   * Calcula custo total de uma BOM com detalhamento por item
   */
  const calculateBOMCost = async (
    bomId: string, 
    bomType: 'recipe' | 'composite',
    multiplier: number = 1
  ): Promise<BOMCostResult> => {
    setLoading(true);
    try {
      let items: MaterialCost[] = [];
      let totalCost = 0;
      const missingCostItems: string[] = [];

      if (bomType === 'composite') {
        // Buscar itens do composite
        const { data: bomItems, error } = await supabase
          .from('composite_bom_items')
          .select(`
            quantity,
            unit,
            materials:component_material_id (
              id,
              name,
              material_type
            )
          `)
          .eq('composite_id', bomId);

        if (error) throw error;

        for (const item of bomItems || []) {
          const material = item.materials as any;
          const unitCost = await getMaterialCost(material.id);
          const quantity = item.quantity * multiplier;
          const itemTotalCost = quantity * unitCost;

          if (unitCost === 0) {
            missingCostItems.push(material.name);
          }

          items.push({
            material_id: material.id,
            material_name: material.name,
            unit_cost: unitCost,
            quantity,
            unit: item.unit,
            total_cost: itemTotalCost,
            cost_source: unitCost > 0 ? 'stock' : 'zero'
          });

          totalCost += itemTotalCost;
        }
      } else {
        // Buscar itens do recipe
        const { data: bomItems, error } = await supabase
          .from('recipe_bom_items')
          .select(`
            quantity,
            unit,
            waste_percent,
            materials:material_id (
              id,
              name,
              material_type
            )
          `)
          .eq('recipe_id', bomId);

        if (error) throw error;

        for (const item of bomItems || []) {
          const material = item.materials as any;
          const unitCost = await getMaterialCost(material.id);
          const wasteMultiplier = 1 + ((item.waste_percent || 0) / 100);
          const quantity = item.quantity * multiplier * wasteMultiplier;
          const itemTotalCost = quantity * unitCost;

          if (unitCost === 0) {
            missingCostItems.push(material.name);
          }

          items.push({
            material_id: material.id,
            material_name: material.name,
            unit_cost: unitCost,
            quantity,
            unit: item.unit,
            total_cost: itemTotalCost,
            cost_source: unitCost > 0 ? 'stock' : 'zero'
          });

          totalCost += itemTotalCost;
        }
      }

      const costStatus = missingCostItems.length === 0 
        ? 'complete' 
        : missingCostItems.length === items.length 
          ? 'unknown' 
          : 'partial';

      return {
        success: true,
        total_cost: totalCost,
        items,
        missing_cost_items: missingCostItems,
        cost_status: costStatus
      };
    } catch (error: any) {
      console.error('Erro ao calcular custo da BOM:', error);
      toast.error('Erro ao calcular custo');
      return {
        success: false,
        total_cost: 0,
        items: [],
        missing_cost_items: [],
        cost_status: 'unknown'
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifica disponibilidade de estoque para produção
   */
  const checkAvailability = async (
    bomId: string,
    bomType: 'recipe' | 'composite',
    multiplier: number = 1
  ): Promise<AvailabilityCheck> => {
    try {
      const { data, error } = await supabase.rpc('check_production_availability', {
        p_bom_id: bomId,
        p_bom_type: bomType,
        p_multiplier: multiplier
      });

      if (error) throw error;
      
      // Garantir tipagem correta do retorno
      const result = data as any;
      return {
        available: result.available || false,
        missing_items: result.missing_items || []
      };
    } catch (error: any) {
      console.error('Erro ao verificar disponibilidade:', error);
      toast.error('Erro ao verificar disponibilidade');
      return {
        available: false,
        missing_items: []
      };
    }
  };

  return {
    getMaterialCost,
    calculateBOMCost,
    checkAvailability,
    loading
  };
};

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MaterialPriceHistory {
  success: boolean;
  material?: {
    id: string;
    name: string;
    purchase_unit: string;
    usage_unit: string;
    conversion_factor: number;
  };
  current_stock?: {
    quantity: number;
    average_price: number;
    total_value: number;
  };
  statistics?: {
    total_movements: number;
    suspicious_movements: number;
    needs_review: boolean;
  };
  recent_movements?: Array<{
    id: string;
    movement_date: string;
    movement_type: string;
    quantity: number;
    unit_price: number;
    notes: string;
  }>;
  error?: string;
}

interface SystemPricingHealth {
  success: boolean;
  summary?: {
    total_materials: number;
    materials_with_stock: number;
    materials_no_price: number;
    materials_no_movement: number;
  };
  health_score?: number;
  problem_materials?: Array<{
    material_id: string;
    material_name: string;
    issue: string;
    current_quantity: number;
    average_price: number;
  }>;
  recommendations?: string[];
  error?: string;
}

export const usePricingAnalysis = () => {
  const [loading, setLoading] = useState(false);

  const analyzeMaterialHistory = async (materialId: string): Promise<MaterialPriceHistory> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("analyze_material_price_history", {
        p_material_id: materialId,
      });

      if (error) throw error;
      return data as unknown as MaterialPriceHistory;
    } catch (error: any) {
      toast.error("Erro ao analisar histórico", {
        description: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const analyzeSystemHealth = async (): Promise<SystemPricingHealth> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("analyze_system_pricing_health");

      if (error) throw error;
      return data as unknown as SystemPricingHealth;
    } catch (error: any) {
      toast.error("Erro ao analisar sistema", {
        description: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const recalculateMaterialPrice = async (
    materialId: string,
    dryRun: boolean = true
  ): Promise<any> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("recalculate_material_average_price", {
        p_material_id: materialId,
        p_dry_run: dryRun,
      });

      if (error) throw error;

      const result = data as any;

      if (result.success) {
        if (dryRun) {
          toast.info("Simulação concluída", {
            description: `Novo preço médio: R$ ${result.new_average_price?.toFixed(4)}`,
          });
        } else {
          toast.success("Preço recalculado com sucesso!");
        }
      }

      return result;
    } catch (error: any) {
      toast.error("Erro ao recalcular preço", {
        description: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const getCostSourceSummary = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_cost_source_summary" as any);
      
      if (error) throw error;
      return data as any[];
    } catch (error: any) {
      toast.error("Erro ao buscar resumo de origem de custos", {
        description: error.message,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    analyzeMaterialHistory,
    analyzeSystemHealth,
    recalculateMaterialPrice,
    getCostSourceSummary,
    loading,
  };
};

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockEntryParams {
  materialId: string;
  quantityPurchased: number;
  unitPricePurchase: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

interface StockEntryResult {
  success: boolean;
  movementId?: string;
  purchaseInfo?: {
    quantity: number;
    unit: string;
    unit_price: number;
  };
  convertedInfo?: {
    quantity: number;
    unit: string;
    unit_price: number;
    conversion_factor: number;
  };
  stockBefore?: {
    quantity: number;
    average_price: number;
    total_value: number;
  };
  stockAfter?: {
    quantity: number;
    average_price: number;
    total_value: number;
  };
  error?: string;
  validation?: any;
}

export const useStockEntryWithConversion = () => {
  const [loading, setLoading] = useState(false);

  const processEntry = async (params: StockEntryParams): Promise<StockEntryResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("process_stock_entry_with_conversion", {
        p_material_id: params.materialId,
        p_quantity_purchased: params.quantityPurchased,
        p_unit_price_purchase: params.unitPricePurchase,
        p_reference_type: params.referenceType || "purchase",
        p_reference_id: params.referenceId || null,
        p_notes: params.notes || null,
      });

      if (error) throw error;

      const result = data as unknown as StockEntryResult;

      if (result.success) {
        toast.success("Entrada processada com sucesso!", {
          description: `${result.convertedInfo?.quantity.toFixed(2)} ${result.convertedInfo?.unit} adicionados ao estoque`,
        });
      } else {
        toast.error("Erro ao processar entrada", {
          description: result.error || "Erro desconhecido",
        });
      }

      return result;
    } catch (error: any) {
      toast.error("Erro ao processar entrada", {
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

  return {
    processEntry,
    loading,
  };
};

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  display_order: number;
}

export const usePaymentMethods = (onlyActive = true) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("payment_methods")
      .select("id, name, is_active, display_order")
      .order("display_order", { ascending: true });

    if (onlyActive) query = query.eq("is_active", true);

    const { data } = await query;
    setMethods(data || []);
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => { load(); }, [load]);

  /** Nomes ativos para uso direto em SelectItem */
  const methodNames = methods.filter(m => m.is_active).map(m => m.name);

  return { methods, methodNames, loading, reload: load };
};

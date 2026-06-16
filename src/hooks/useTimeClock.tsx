import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateLocalISO } from "@/lib/date-utils";

export interface TimeRecord {
  id: string;
  employee_id: string;
  record_date: string;
  record_time: string;
  record_type: "entry" | "exit" | "lunch_start" | "lunch_end";
  location_lat?: number;
  location_lng?: number;
  ip_address?: string;
  user_agent?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    full_name: string;
    employee_number: string;
  };
}

export const useTimeClock = (date?: Date) => {
  const queryClient = useQueryClient();
  const today = date || new Date();
  const dateString = formatDateLocalISO(today);

  // Query para buscar registros do dia
  const { data: records, isLoading } = useQuery({
    queryKey: ["time-records", dateString],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_records")
        .select(`
          *,
          employees (
            full_name,
            employee_number
          )
        `)
        .eq("record_date", dateString)
        .order("record_time", { ascending: true });

      if (error) throw error;
      return data as TimeRecord[];
    },
  });

  // Mutation para registrar ponto
  const registerTime = useMutation({
    mutationFn: async ({
      employeeId,
      recordType,
      notes,
    }: {
      employeeId: string;
      recordType: TimeRecord["record_type"];
      notes?: string;
    }) => {
      const now = new Date();
      const recordDate = formatDateLocalISO(now);
      const recordTime = now.toTimeString().split(" ")[0];

      // Obter geolocalização se disponível
      let location = { lat: null, lng: null };
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false,
            });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (error) {
          console.log("Geolocation not available:", error);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("time_records")
        .insert({
          employee_id: employeeId,
          record_date: recordDate,
          record_time: recordTime,
          record_type: recordType,
          location_lat: location.lat,
          location_lng: location.lng,
          user_agent: navigator.userAgent,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
      toast.success("Ponto registrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar ponto: ${error.message}`);
    },
  });

  // Mutation para deletar registro
  const deleteRecord = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from("time_records")
        .delete()
        .eq("id", recordId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
      toast.success("Registro deletado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao deletar registro: ${error.message}`);
    },
  });

  return {
    records: records || [],
    isLoading,
    registerTime: registerTime.mutateAsync,
    isRegistering: registerTime.isPending,
    deleteRecord: deleteRecord.mutateAsync,
    isDeleting: deleteRecord.isPending,
  };
};

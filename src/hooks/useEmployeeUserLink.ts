import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnlinkedUser {
  user_id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
}

export interface UnlinkedEmployee {
  id: string;
  full_name: string;
  employee_number: string;
  department: string;
  position: string;
}

export interface LinkedEmployeeSummary {
  id: string;
  full_name: string;
  employee_number: string;
  department: string;
  position: string;
  status: string;
}

export interface LinkedUserSummary {
  user_id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
}

const UNLINKED_USERS_KEY = ["unlinked-users"] as const;
const UNLINKED_EMPLOYEES_KEY = ["unlinked-employees"] as const;

export function useUnlinkedUsers(enabled: boolean) {
  return useQuery({
    queryKey: UNLINKED_USERS_KEY,
    enabled,
    queryFn: async (): Promise<UnlinkedUser[]> => {
      const [{ data: profiles, error: profilesError }, { data: linked, error: linkedError }] =
        await Promise.all([
          supabase.from("user_profiles").select("user_id, email, full_name, display_name"),
          supabase.from("employees").select("user_id").not("user_id", "is", null),
        ]);
      if (profilesError) throw profilesError;
      if (linkedError) throw linkedError;

      const linkedIds = new Set((linked || []).map((e) => e.user_id));
      return (profiles || [])
        .filter((p) => !linkedIds.has(p.user_id))
        .map((p) => ({
          user_id: p.user_id,
          email: p.email || "",
          full_name: p.full_name,
          display_name: p.display_name,
        }));
    },
  });
}

export function useUnlinkedEmployees(enabled: boolean) {
  return useQuery({
    queryKey: UNLINKED_EMPLOYEES_KEY,
    enabled,
    queryFn: async (): Promise<UnlinkedEmployee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_number, department, position")
        .is("user_id", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEmployeeLinkStatus(employeeId: string, initialUserId: string | null) {
  return useQuery({
    queryKey: ["employee-link-status", employeeId],
    initialData: initialUserId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data.user_id;
    },
  });
}

export function useLinkedEmployeeForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["linked-employee-for-user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LinkedEmployeeSummary | null> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_number, department, position, status")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useLinkedUserForEmployee(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["linked-user-for-employee", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LinkedUserSummary | null> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, email, full_name, display_name")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function invalidateLinkQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: UNLINKED_USERS_KEY });
  queryClient.invalidateQueries({ queryKey: UNLINKED_EMPLOYEES_KEY });
  queryClient.invalidateQueries({ queryKey: ["linked-employee-for-user"] });
  queryClient.invalidateQueries({ queryKey: ["linked-user-for-employee"] });
  queryClient.invalidateQueries({ queryKey: ["employee-link-status"] });
}

export function useLinkEmployeeUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, userId }: { employeeId: string; userId: string }) => {
      const { error } = await supabase.from("employees").update({ user_id: userId }).eq("id", employeeId);
      if (error) {
        if (error.code === "23505") {
          throw new Error("Este usuário já está vinculado a outro funcionário.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Vínculo criado com sucesso");
      invalidateLinkQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao vincular");
    },
  });
}

export function useUnlinkEmployeeUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.from("employees").update({ user_id: null }).eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      invalidateLinkQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desvincular");
    },
  });
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from './useUserRole';
import { useSecurityMonitoring } from './useSecurityMonitoring';
import { useEnhancedSecurityMonitoring } from './useEnhancedSecurityMonitoring';

interface SecureClientData {
  id: string;
  name: string;
  cnpj_cpf?: string;
  cnpj_cpf_display?: string;
  email?: string;
  email_display?: string;
  phone?: string;
  phone_display?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useSecureClientData() {
  const [clients, setClients] = useState<SecureClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { logPIIAccess } = useSecurityMonitoring();
  const { logPIIAccessWithAnomalyDetection } = useEnhancedSecurityMonitoring();

  const fetchClients = async (filters?: {
    searchTerm?: string;
    status?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_masked_client_data");

      if (error) throw error;

      let filteredData = data || [];

      // Apply client-side filters
      if (filters?.status && filters.status !== "all") {
        filteredData = filteredData.filter((client: any) => client.status === filters.status);
      }

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter((client: any) => 
          client.name?.toLowerCase().includes(searchLower) ||
          client.cnpj_cpf_display?.toLowerCase().includes(searchLower) ||
          client.email_display?.toLowerCase().includes(searchLower)
        );
      }

      setClients(filteredData);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes: " + error.message,
        variant: "destructive",
      });
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const getClientById = async (id: string): Promise<SecureClientData | null> => {
    try {
      // Log PII access for detailed view with anomaly detection
      await logPIIAccessWithAnomalyDetection(id, 'CLIENT_DETAIL_VIEW', ['cnpj_cpf', 'email', 'phone', 'address'], 'clients');

      const { data, error } = await supabase.rpc("get_masked_client_data");
      
      if (error) throw error;
      
      const client = data?.find((client: any) => client.id === id);
      return client || null;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do cliente: " + error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const saveClient = async (clientData: any, isUpdate: boolean = false) => {
    try {
      // Clean the client data to match database schema
      const cleanClientData = {
        name: clientData.name,
        cnpj_cpf: clientData.cnpj_cpf,
        email: clientData.email,
        phone: clientData.phone,
        contact_person: clientData.contact_person,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        zip_code: clientData.zip_code,
        status: clientData.status,
        notes: clientData.notes
      };
      
      let result;
      
      if (isUpdate && clientData.id) {
        // Update existing client
        const { data, error } = await supabase
          .from("clients")
          .update(cleanClientData)
          .eq("id", clientData.id)
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        // Log PII update
        await logPIIAccess(clientData.id, 'CLIENT_UPDATE', ['client_data']);
        
      } else {
        // Create new client
        const { data, error } = await supabase
          .from("clients")
          .insert(cleanClientData)
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        if (result?.id) {
          await logPIIAccess(result.id, 'CLIENT_CREATE', ['client_data']);
        }
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cliente.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteClient = async (id: string) => {
    try {
      // Log PII access before deletion
      await logPIIAccess(id, 'CLIENT_DELETE', ['client_data']);
      
      const { error } = await supabase.from("clients").delete().eq("id", id);
      
      if (error) throw error;
      
      toast({
        title: "Cliente removido",
        description: "O cliente foi removido com sucesso.",
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao remover cliente: " + error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Bulk operations monitoring
  const logBulkAccess = async (operation: string, count: number) => {
    if (count > 10) { // Alert for bulk operations
      await logPIIAccess(null, `BULK_${operation}`, [`bulk_client_access_${count}_records`]);
    }
  };

  return {
    clients,
    loading,
    fetchClients,
    getClientById,
    saveClient,
    deleteClient,
    logBulkAccess,
    canViewSensitiveData: isAdmin
  };
}
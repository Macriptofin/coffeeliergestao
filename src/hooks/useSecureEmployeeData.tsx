import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from './useUserRole';

interface SecureEmployeeData {
  id: string;
  employee_number: string;
  full_name: string;
  cpf?: string;
  cpf_display?: string;
  rg?: string;
  rg_display?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  department: string;
  position: string;
  hire_date: string;
  termination_date?: string;
  employment_type: string;
  benefits?: string[];
  pis_pasep?: string;
  ctps_number?: string;
  ctps_series?: string;
  voter_registration?: string;
  military_service?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account?: string;
  account_type?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  salary_amount?: number;
}

export function useSecureEmployeeData() {
  const [employees, setEmployees] = useState<SecureEmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  const fetchEmployees = async (filters?: {
    searchTerm?: string;
    department?: string;
    status?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_masked_employee_data");

      if (error) throw error;

      let filteredData = data || [];

      // Apply client-side filters
      if (filters?.department && filters.department !== "all") {
        filteredData = filteredData.filter((emp: any) => emp.department === filters.department);
      }

      if (filters?.status && filters.status !== "all") {
        filteredData = filteredData.filter((emp: any) => emp.status === filters.status);
      }

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter((emp: any) => 
          emp.full_name?.toLowerCase().includes(searchLower) ||
          emp.cpf_display?.toLowerCase().includes(searchLower) ||
          emp.employee_number?.toLowerCase().includes(searchLower)
        );
      }

      setEmployees(filteredData);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar colaboradores: " + error.message,
        variant: "destructive",
      });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const logPIIAccess = async (employeeId: string, accessType: string, fields: string[]) => {
    try {
      await supabase.rpc('log_pii_access', {
        p_table_name: 'employees',
        p_employee_id: employeeId,
        p_access_type: accessType,
        p_pii_fields: fields
      });
    } catch (error) {
      console.warn('Failed to log PII access:', error);
    }
  };

  const getEmployeeById = async (id: string): Promise<SecureEmployeeData | null> => {
    try {
      // Log PII access for detailed view
      await logPIIAccess(id, 'DETAIL_VIEW', ['cpf', 'rg', 'salary', 'personal_data']);

      const { data, error } = await supabase.rpc("get_masked_employee_data");
      
      if (error) throw error;
      
      const employee = data?.find((emp: any) => emp.id === id);
      return employee || null;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do colaborador: " + error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const saveEmployee = async (employeeData: any, isUpdate: boolean = false) => {
    try {
      // Separate salary data for secure handling
      const { salary_amount, cpf_display, rg_display, ...baseEmployeeData } = employeeData;
      
      // Clean the employee data to match database schema
      const cleanEmployeeData = {
        employee_number: baseEmployeeData.employee_number,
        full_name: baseEmployeeData.full_name,
        cpf: baseEmployeeData.cpf,
        rg: baseEmployeeData.rg,
        birth_date: baseEmployeeData.birth_date,
        gender: baseEmployeeData.gender,
        marital_status: baseEmployeeData.marital_status,
        email: baseEmployeeData.email,
        phone: baseEmployeeData.phone,
        mobile_phone: baseEmployeeData.mobile_phone,
        emergency_contact_name: baseEmployeeData.emergency_contact_name,
        emergency_contact_phone: baseEmployeeData.emergency_contact_phone,
        address: baseEmployeeData.address,
        city: baseEmployeeData.city,
        state: baseEmployeeData.state,
        zip_code: baseEmployeeData.zip_code,
        department: baseEmployeeData.department,
        position: baseEmployeeData.position,
        hire_date: baseEmployeeData.hire_date,
        termination_date: baseEmployeeData.termination_date,
        employment_type: baseEmployeeData.employment_type,
        benefits: baseEmployeeData.benefits,
        pis_pasep: baseEmployeeData.pis_pasep,
        ctps_number: baseEmployeeData.ctps_number,
        ctps_series: baseEmployeeData.ctps_series,
        voter_registration: baseEmployeeData.voter_registration,
        military_service: baseEmployeeData.military_service,
        bank_name: baseEmployeeData.bank_name,
        bank_branch: baseEmployeeData.bank_branch,
        bank_account: baseEmployeeData.bank_account,
        account_type: baseEmployeeData.account_type,
        status: baseEmployeeData.status,
        notes: baseEmployeeData.notes
      };
      
      let result;
      
      if (isUpdate && employeeData.id) {
        // Update existing employee
        const { data, error } = await supabase
          .from("employees")
          .update(cleanEmployeeData)
          .eq("id", employeeData.id)
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        // Update salary separately if user is admin and salary is provided
        if (isAdmin && salary_amount !== undefined && salary_amount !== null) {
          const { error: salaryError } = await supabase
            .from("employee_salary_info")
            .upsert({
              employee_id: employeeData.id,
              salary: salary_amount
            }, {
              onConflict: 'employee_id'
            });
          
          if (salaryError) throw salaryError;
        }
        
        await logPIIAccess(employeeData.id, 'UPDATE', ['employee_data']);
        
      } else {
        // Create new employee
        const { data, error } = await supabase
          .from("employees")
          .insert(cleanEmployeeData)
          .select();
        
        if (error) throw error;
        result = data?.[0];
        
        // Insert salary separately if user is admin and salary provided  
        if (isAdmin && salary_amount !== undefined && salary_amount !== null && result?.id) {
          const { error: salaryError } = await supabase
            .from("employee_salary_info")
            .upsert({
              employee_id: result.id,
              salary: salary_amount
            }, {
              onConflict: 'employee_id'
            });
          
          if (salaryError) throw salaryError;
        }
        
        if (result?.id) {
          await logPIIAccess(result.id, 'CREATE', ['employee_data']);
        }
      }
      
      return result;
    } catch (error: any) {
      console.error('Error saving employee:', error);
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await logPIIAccess(id, 'DELETE', ['employee_data']);
      
      const { error } = await supabase.from("employees").delete().eq("id", id);
      
      if (error) throw error;
      
      toast({
        title: "Colaborador removido",
        description: "O colaborador foi removido com sucesso.",
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao remover colaborador: " + error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    employees,
    loading,
    fetchEmployees,
    getEmployeeById,
    saveEmployee,
    deleteEmployee,
    logPIIAccess,
    canViewSalary: isAdmin
  };
}
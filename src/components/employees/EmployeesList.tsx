import { useState, useEffect } from "react";
import { Edit, Trash2, Eye, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecureEmployeeData } from "@/hooks/useSecureEmployeeData";

interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  cpf?: string;
  cpf_display?: string;
  rg_display?: string;
  department: string;
  position: string;
  hire_date: string;
  email?: string;
  mobile_phone?: string;
  status: string;
  employment_type: string;
  salary?: number;
  salary_amount?: number;
}

interface EmployeesListProps {
  searchTerm: string;
  selectedDepartment: string;
  selectedStatus: string;
  onEditEmployee: (employee: Employee) => void;
}

export const EmployeesList = ({ 
  searchTerm, 
  selectedDepartment, 
  selectedStatus, 
  onEditEmployee 
}: EmployeesListProps) => {
  const { toast } = useToast();
  const { 
    employees, 
    loading, 
    fetchEmployees, 
    deleteEmployee, 
    canViewSalary 
  } = useSecureEmployeeData();

  useEffect(() => {
    fetchEmployees({
      searchTerm,
      department: selectedDepartment,
      status: selectedStatus
    });
  }, [searchTerm, selectedDepartment, selectedStatus]);

  const handleDelete = async (id: string) => {
    const success = await deleteEmployee(id);
    if (success) {
      fetchEmployees({
        searchTerm,
        department: selectedDepartment,
        status: selectedStatus
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo":
        return "bg-green-100 text-green-800 border-green-200";
      case "Inativo":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "Férias":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Licença":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Demitido":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            {searchTerm || selectedDepartment !== "all" || selectedStatus !== "all" 
              ? "Nenhum colaborador encontrado com os filtros aplicados." 
              : "Nenhum colaborador cadastrado ainda."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {employees.map((employee) => (
        <Card key={employee.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-xl">{employee.full_name}</CardTitle>
                  <Badge className={getStatusColor(employee.status)}>
                    {employee.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Matrícula: {employee.employee_number}</span>
                  {employee.cpf_display && <span>CPF: {employee.cpf_display}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditEmployee(employee)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o colaborador {employee.full_name}? 
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(employee.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Dados Profissionais</h4>
                <p className="text-sm text-muted-foreground">{employee.department}</p>
                <p className="text-sm font-medium">{employee.position}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {employee.employment_type} • Desde {format(new Date(employee.hire_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              {employee.email && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Contato</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3 w-3" />
                    <span className="text-muted-foreground truncate">{employee.email}</span>
                  </div>
                  {employee.mobile_phone && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Phone className="h-3 w-3" />
                      <span className="text-muted-foreground">{employee.mobile_phone}</span>
                    </div>
                  )}
                </div>
              )}

              {canViewSalary && employee.salary_amount && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Salário</h4>
                  <p className="text-sm font-medium text-green-600">
                    R$ {employee.salary_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditEmployee(employee)}
                  className="text-primary hover:text-primary-foreground hover:bg-primary"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver detalhes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
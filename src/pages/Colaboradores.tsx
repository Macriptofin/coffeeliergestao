import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EmployeesList } from "@/components/employees/EmployeesList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Colaboradores = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("list");

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowForm(true);
    setActiveTab("form");
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
    setActiveTab("form");
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEmployee(null);
    setActiveTab("list");
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "list") {
      setShowForm(false);
      setEditingEmployee(null);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Colaboradores</h1>
            <p className="text-muted-foreground">
              Gestão completa do cadastro de funcionários
            </p>
          </div>
          <Button onClick={handleAddEmployee} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Colaborador
          </Button>
        </div>

        {/* Filtros de busca */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-foreground"
              >
                <option value="all">Todos os Departamentos</option>
                <option value="Produção">Produção</option>
                <option value="Vendas">Vendas</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Financeiro">Financeiro</option>
                <option value="RH">RH</option>
                <option value="Estoque">Estoque</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-foreground"
              >
                <option value="all">Todos os Status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Férias">Férias</option>
                <option value="Licença">Licença</option>
                <option value="Demitido">Demitido</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="list">Lista de Colaboradores</TabsTrigger>
          <TabsTrigger value="form" disabled={!showForm}>
            {editingEmployee ? "Editar Colaborador" : "Novo Colaborador"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <EmployeesList
            searchTerm={searchTerm}
            selectedDepartment={selectedDepartment}
            selectedStatus={selectedStatus}
            onEditEmployee={handleEditEmployee}
          />
        </TabsContent>

        <TabsContent value="form">
          {showForm && (
            <EmployeeForm
              employee={editingEmployee}
              onClose={handleCloseForm}
              onSuccess={() => {
                setShowForm(false);
                setEditingEmployee(null);
                setActiveTab("list");
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Colaboradores;
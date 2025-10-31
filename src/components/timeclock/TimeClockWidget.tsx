import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, LogIn, LogOut, Coffee, UtensilsCrossed } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTimeClock } from "@/hooks/useTimeClock";

export const TimeClockWidget = () => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [recordType, setRecordType] = useState<"entry" | "exit" | "lunch_start" | "lunch_end">("entry");
  const [notes, setNotes] = useState("");

  const { registerTime, isRegistering } = useTimeClock();

  const { data: employees } = useQuery({
    queryKey: ["active-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_number")
        .eq("status", "Ativo")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const handleRegister = async () => {
    if (!selectedEmployee) {
      return;
    }

    await registerTime({
      employeeId: selectedEmployee,
      recordType,
      notes: notes.trim() || undefined,
    });

    setNotes("");
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case "entry":
        return <LogIn className="h-4 w-4" />;
      case "exit":
        return <LogOut className="h-4 w-4" />;
      case "lunch_start":
        return <UtensilsCrossed className="h-4 w-4" />;
      case "lunch_end":
        return <Coffee className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case "entry":
        return "Entrada";
      case "exit":
        return "Saída";
      case "lunch_start":
        return "Início do Almoço";
      case "lunch_end":
        return "Fim do Almoço";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Registrar Ponto</CardTitle>
            <CardDescription>Registre entrada, saída ou intervalos</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employee">Colaborador</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o colaborador" />
            </SelectTrigger>
            <SelectContent>
              {employees?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.employee_number} - {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipo de Registro</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={recordType === "entry" ? "default" : "outline"}
              onClick={() => setRecordType("entry")}
              className="justify-start"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Entrada
            </Button>
            <Button
              variant={recordType === "exit" ? "default" : "outline"}
              onClick={() => setRecordType("exit")}
              className="justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Saída
            </Button>
            <Button
              variant={recordType === "lunch_start" ? "default" : "outline"}
              onClick={() => setRecordType("lunch_start")}
              className="justify-start"
            >
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Início Almoço
            </Button>
            <Button
              variant={recordType === "lunch_end" ? "default" : "outline"}
              onClick={() => setRecordType("lunch_end")}
              className="justify-start"
            >
              <Coffee className="h-4 w-4 mr-2" />
              Fim Almoço
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Adicione observações sobre este registro..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          onClick={handleRegister}
          disabled={!selectedEmployee || isRegistering}
          className="w-full"
          size="lg"
        >
          {getRecordTypeIcon(recordType)}
          <span className="ml-2">
            {isRegistering ? "Registrando..." : `Registrar ${getRecordTypeLabel(recordType)}`}
          </span>
        </Button>

        <div className="text-xs text-muted-foreground text-center">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          • {new Date().toLocaleTimeString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
};

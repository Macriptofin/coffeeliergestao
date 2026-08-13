import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Briefcase, Link2, Unlink } from "lucide-react";
import {
  useLinkedEmployeeForUser,
  useUnlinkedEmployees,
  useLinkEmployeeUser,
  useUnlinkEmployeeUser,
} from "@/hooks/useEmployeeUserLink";

interface UserEmployeeLinkProps {
  userId: string;
}

export function UserEmployeeLink({ userId }: UserEmployeeLinkProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const { data: employee, isPending, refetch } = useLinkedEmployeeForUser(userId);
  const { data: unlinkedEmployees = [], isPending: loadingUnlinked } = useUnlinkedEmployees(!isPending && !employee);
  const linkMutation = useLinkEmployeeUser();
  const unlinkMutation = useUnlinkEmployeeUser();

  if (isPending) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        <Briefcase className="h-4 w-4" />
        Funcionário Vinculado (RH)
      </h4>
      {employee ? (
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg flex-wrap gap-2">
          <div>
            <p className="font-medium">{employee.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {employee.position} • {employee.department} • Matrícula {employee.employee_number}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/rh/colaboradores">Ver cadastro completo no RH →</Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Unlink className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desvincular funcionário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O cadastro do funcionário no RH não é afetado, só deixa de estar associado a esta conta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => unlinkMutation.mutate(employee.id, { onSuccess: () => refetch() })}
                  >
                    Desvincular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUnlinked ? "Carregando..." : "Vincular a um funcionário do RH (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                {unlinkedEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name} — {e.position} ({e.department})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedEmployeeId || linkMutation.isPending}
            onClick={() =>
              linkMutation.mutate(
                { employeeId: selectedEmployeeId, userId },
                { onSuccess: () => { setSelectedEmployeeId(""); refetch(); } }
              )
            }
          >
            <Link2 className="h-4 w-4 mr-2" />
            Vincular
          </Button>
        </div>
      )}
    </div>
  );
}
